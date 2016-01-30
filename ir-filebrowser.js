/**
	* @license
	* Copyright (c) 2015 Igor Rubinovich. All rights reserved.
	* This code may only be used under the MIT license found at http://opensource.org/licenses/MIT
	*
	* File browser and uploader.
	* Works with arrays of (node fs.Stats)[https://nodejs.org/api/fs.html#fs_class_fs_stats] objects.
	* Example:
    * <ir-file-browser>DEMO HERE</ir-file-browser>
	* @demo
 */

(function () {
	Polymer({
		is : 'ir-filebrowser',


		/**
		  * Loads list of files at location relative to the this.relPath
		  *
		  * @method ls
		*/
		ls : function(relPath, abs)
		{
			if(typeof relPath !== 'string')
				relPath  = "";

			if(relPath)
				this.set("filterValue", "");

			if(abs !== true) {
				var p, split, newSplit;
				split = this.relPath.split('/');
				newSplit = relPath.split('/');

				if (split.length && !split[split.length - 1]) // chop last if empty
					split.pop();
				if (newSplit.length && !newSplit[newSplit.length - 1])
					newSplit.pop();

				while (newSplit.length) // just like node's path.resolve(this.relPath, relPath)
				{
					p = newSplit.shift();
					if (p == '..')
						split.pop();
					else if (p)
						split.push(p);
				};

				this.relPath = split.join('/');
			}
			else
			{
				if(/\.{2,}/.test(relPath))
				{
					this.status = 403;
					throw new Error("Acess forbidden (did you use '..' in requested path?)");

				};

				this.relPath = relPath;
			}

			if(this.relPath)
				this.relPath += '/';

			var reqUrl = this._lsUrl.replace(/\[path\]/, this.relPath).replace(/\/\//, "/");

			if(this._lsUrl == reqUrl)
				reqUrl += this.relPath; //this.host + reqUrl; error!

			this.$.loader.url = reqUrl;
			this.$.loader.generateRequest();

			this.postFields.path = this.relPath;
		},

/**
  * Displays files loaded as a result of calling ls or user typing into the filter box
  *
  * @method displayLoadedFiles
*/
		displayLoadedFiles : function () {
			var t,
				i,
				ext,
				name,
				fstat,
				sorted,
				rootUrl,
				statsData,
				files = [],
				that = this,
				directories = [];

			this.loadedFiles = [];
			this.loadedDirectories = [];

			if(!this.loadedData)
				return;

			this.files = [];
			this.directories = [];

			rootUrl = path.join(this.host, this.get(this.lsRootUrlPath, this.loadedData));
			statsData = this.get(this.lsStatsPath, this.loadedData).filter(function(stat) { return that.filterValue ? (new RegExp(that.filterValue, "i")).test(stat.name) : true; });

			sorted = statsData.sort(function(x,y) { return (new Date(y.mtime)).getTime() - (new Date(x.mtime)).getTime() });

			for(var i=0; i < sorted.length; i++)
			{
				fstat = sorted[i];

				fstat.rootUrl = rootUrl;
				// fstat.lsRootUrlPath = this.lsRootUrlPath;
				fstat.url = path.join(rootUrl.replace(/ /g, '%20'), encodeURIComponent(fstat.name).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/!/, "%21").replace(' ', "%20"));
				fstat.relPath = this.relPath;

				// look for items with same url as in selection and select them in the filebrowser dialog
				this.getContentChildren()
					.filter(function(el) { return el.is == 'ir-filebrowser-item' && (el.item.url == fstat.url) })
					.forEach(function(el) { fstat.isSelected = true });
				Polymer.dom.flush();

				if(fstat.isDirectory)
					directories.push(fstat);
				else
					files.push(fstat);
			};


			if(this.isFirstTimeOpened)
			{
				var date = new Date(),
					year = date.getFullYear(),
					month = date.getMonth() + 1;

					if(month < 10)
						month = "0" + month;

				if(this.relPath == "")
				{
					for(var i = 0; i < directories.length; i++)
						if(year == directories[i].name)
						{
							this.ls(this.relPath + year);
							return;
						}

					this.$.makedirloader.body = {name : year, fpath : this.relPath};
					this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
					this.$.makedirloader.url = this._makedirUrl;
					this.$.makedirloader.generateRequest();

					this.ls(this.relPath + year);
					return;

				}
				else
				{
					for(var i = 0; i < directories.length; i++)
						if(month == directories[i].name)
						{
							this.isFirstTimeOpened = false;
							this.ls(month);
							return;
						}

					this.$.makedirloader.body = {name : month, fpath : this.relPath};
					this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
					this.$.makedirloader.url = this._makedirUrl;
					this.$.makedirloader.generateRequest();

					this.isFirstTimeOpened = false;
					this.ls(month);
					return;
				}
			};

			if(!(/^\/?$/.test(this.relPath))) // create an '..' directory entry
				directories.unshift({
					name: '..',
					ext: '..',
					isDirectory: true,
					relPath: this.relPath,
					rootUrl: rootUrl
				});

			this._directories = directories;
			this._files = files;
			this.upFiles = files;

			this.set('directories', this._directories.splice(0, this.limit));
			this.set('files', this._files.splice(0, (this.directories.length < this.limit ? -1 : 1 ) * (this.directories.length - this.limit)));
			this.currentTime = 0;

			if(!this._itemsListenerAttached)
			{
				this.addEventListener('item-attached', this.refitDialog, true);
				this._itemsListenerAttached = true;
			}

			//else
			//	this.removeEventListener('item-attached', this.refitDialog, true);

			if(!/^\//.test(this.relPath))
				this.set("relPath", "/" + this.relPath)

			this.splitRelPath = this.relPath.split('/');
			this.splitRelPath.pop();
			if(!(/^\/?$/.test(this.splitRelPath[0])))
			{
				this.set("splitRelPath.0",  '/');
			}
			console.log(this.splitRelPath);
			//this.notifyPath("splitRelPath.splices");


			Polymer.dom.flush();
			this.set('isLoaded', false);

			that.lsAfterUpload();

			//this.files = res;
		},

		loadMoreFiles : function(e) {
			var scrollerHeight = e.currentTarget.scrollHeight,
				allFiles = this._files + this._directories;

			var date = new Date();
			var newtime = date.getMinutes()*60000 +  date.getSeconds()*1000 + date.getMilliseconds();

			if((scrollerHeight - e.currentTarget.scrollTop <= 600) && allFiles.length > 0)
			{
				this.set('isLoaded', true);
				var that = this;
				setTimeout(function(){
					that.set('isLoaded', false);
				}, 400);
				if(newtime - this.currentTime >= 400)
				{
					this.push.apply(this, ['directories'].concat(this._directories.splice(0, this.limit)));
					this.push.apply(this, ['files'].concat(this._files.splice(0, (this.directories.length < this.limit ? -1 : 1 ) * (this.directories.length - this.limit))));

					this.currentTime = newtime;
				}
			}
		},

		refitDialog : function() {
			if(this.fullView) {

				this.$.dialog.refit();

				this.async(function() {
					this.$.dialog.fitInto = Polymer.dom(this).parentNode;

					this.$.dialog.style.bottom = this.$.dialog.style.top = this.$.dialog.style.left = this.$.dialog.style.right = "0";
					this.$.dialog.style.height = "auto";
					this.$.dialog.style.position = "absolute";
					this.$.dialog.style.zIndex = "0";

					Polymer.updateStyles();
					Polymer.dom.flush();

					var currentHeight = Number(getComputedStyle(this.$.dialog).height.replace(/px/, '')),
						topTabsHeight = Number(getComputedStyle(this.$.topTabs).height.replace(/px/, '')),
						bottomButtonsHeight = Number(getComputedStyle(this.$.bottomButtons).height.replace(/px/, ''));

					this.$.scrollableDialog.scrollTarget.style.height = this.$.scrollableDialog.scrollTarget.style.maxHeight = (currentHeight - topTabsHeight - bottomButtonsHeight - 58) + "px";
					this.$.scrollableDialog.style.height = this.$.scrollableDialog.style.maxHeight = (currentHeight - topTabsHeight - bottomButtonsHeight - 58) + "px";
					this.$.uploaderContainer.style.height = (currentHeight - topTabsHeight - bottomButtonsHeight - 58) + "px";
				});

				return;
			}
			if(this.archiveMode)
			{
				this.$.dialog.refit();

				this.async(function () {
					this.$.dialog.fitInto = Polymer.dom(this).parentNode;

					this.$.dialog.style.position = "";
					this.$.dialog.style.bottom = this.$.dialog.style.top = this.$.dialog.style.left = this.$.dialog.style.right = "0";
					this.$.dialog.style.height = "auto";
					this.$.dialog.style.zIndex = "0";

					Polymer.updateStyles();
					Polymer.dom.flush();
				});

				return;
			}

			// else

			var currentWidth = Number(getComputedStyle(this.$.dialog).width.replace(/px/, ''));
			if (!this._maxWidth || (this._maxWidth < currentWidth))
				this._maxWidth = currentWidth;

			this.$.dialog.refit();

			this.async(function () {
				var currentWidth = Number(getComputedStyle(this.$.dialog).width.replace(/px/, ''));
				this.$.dialog.left="33%";
				this.$.dialog.right="33%";

				this.$.dialog.constrain();
				this.$.dialog.style.width = this._maxWidth + "px";
				this.$.dialog.center();

				Polymer.dom.flush();

				this.$.scrollableDialog.scrollTarget.style.height = this.$.scrollableDialog.scrollTarget.style.maxHeight = this.$.uploaderContainer.style.height = getComputedStyle(this.$.scrollableDialog).height;
			})
		},

		makeDir : function(relPath) {
			var namebyuser = prompt("Folder name", "your folder name");
			if (namebyuser !== null) {
				this.$.makedirloader.body = {name : namebyuser, fpath : this.relPath};
				this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
				this.$.makedirloader.url = this._makedirUrl;
				this.$.makedirloader.generateRequest();
			};
		},

		updateVal : function(relPath) {
			if(!this.isFirstTimeOpened);
				this.ls(relPath);
		},

		searchBoxKeyDown: function(e) {
			if((e.which || e.keyCode) == 13)
			{
				this.findFile();
				e.preventDefault();
			}
		},

		blockBackspace : function(e) {
			if(e.keyCode == 8 && e.target.tagName !== "INPUT")
				e.preventDefault();
		},

		findFile : function() {
			if (this.inputValue !== null){
				this.$.findfileloader.url = this._findfileUrl.replace(/\[path\]/, encodeURIComponent(this.inputValue).replace(/-/g, '%2D').replace(/\./g, '%2E').replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/!/, "%21"));  //"/medialib/json/find/" + this.inputValue;
				this.$.findfileloader.generateRequest();
			};
		},

		showfoundFiles : function() {
			this.async(function(){
				var foundArr = this.foundFile,
					foundList = [];
				this.foundList = [];

				for (var i = 0; i < foundArr.length; i++)
					foundList.push(foundArr[i]);

				this.set("foundList", foundList);
			});
		},

		renameFile : function() {
			this.set("renameFiles", !this.renameFiles);
			if(this.renameFiles && this.fileName)
			{
				var fname = this.fileName,
					rename = prompt("New file name", fname);
				if ((fname && rename) !== null) {
					this.$.renamefileloader.url = this._renameUrl.replace(/\[path\]/, encodeURIComponent(fname).replace(/\./g, '%2E').replace(/-/g, '%2D').replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/!/, "%21"));  //"/medialib/json/rename/" + fname;
					this.$.renamefileloader.contentType = "application/x-www-form-urlencoded";
					this.$.renamefileloader.body = {name: rename, fpath : this.relPath};
					this.$.renamefileloader.generateRequest();
				};
			}

			this.renameFiles = false;
		},

		searchFiles : function(e) {
			if(e.type == 'tap' || e.keyCode == 13)
			{
				e.preventDefault();
				this.$.searchByDesc.url = this._searchbydescUrl.replace(/\[path\]/, this.searchValue);
				this.$.searchByDesc.contentType = "application/x-www-form-urlencoded";
				this.$.searchByDesc.generateRequest();
			}
		},

		listDesire : function() {
			this.splice('filesList', 0);
				if(this.desiredFiles[0] == "notFound")
					this.push('filesList', { name : 'not found', content : '', path : '' });
				else
					for(var i = 0; i < this.desiredFiles.length; i++)
					{
					this.push('filesList', this.desiredFiles[i]);
					}

				this.$.desiredList.open();
		},

		nothingFound : function() {
			this.splice('filesList', 0);
			this.push('filesList', { name : 'wrong query', content : '', path : '' });
		},

		searchClear : function() {
			this.set('searchValue', "");
			this.splice('filesList', 0);
		},

		deleteFile : function() {
			var filesToDelete = this._getSelectionElements(),
				filesList = "";

			if(filesToDelete.length > 0 || this.fileName) {
				if(filesToDelete.length > 0)
					for(var i = 0; i < filesToDelete.length; i++)
						filesList += filesToDelete[i].item.name + ',';
				else
					if(this.fileName && this.noFile)
						filesList = this.fileName;

				var askUser = confirm("Are you sure you want to delete " + filesList.replace(/,$/, "?"));
				if (askUser == true) {
					this.set('noFile', true);
					this.$.deletefileloader.body = {name: filesList.replace(/,$/, '').split(','), fpath: this.relPath};
					this.$.deletefileloader.contentType = "application/x-www-form-urlencoded";
					this.$.deletefileloader.url = this._deletefileUrl;
					this.$.deletefileloader.generateRequest();
				}
			}
			else
				alert("Choose file to delete");
		},

		cannotDelete : function() {
			if(this.deleteFileError)
				alert("Could not delete directory, make sure it's empty");
		},

		filterClear : function() {
			this.set("filterValue", '');
			this.ls();
		},

		jumptofilePath : function(e) {
			var item = e.model.item;

			this.tableselected = "0";
			this.ls(item.shortpath, true);
			this.set("filterValue", item.name);
		},

		jumpUp : function(e){
			this.ls(e.model.item, true);
			this.set("filterValue", "");
		},

		clickDirectory : function(e) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
		},


/**
Adds object to selection.
@param (Object|String) url string or nodejs fstat-like object.
 */
		addSelection : function(fstat) {
			var newEl, that = this;
			var selectedElements = this._getSelectionElements();

			// maxItems == 1 is special case: if there's a selected item it is unselected and new item is selected instead
			if(this.maxItems == 1 && (selectedElements.length == 1))
				this.clearSelection();
			else if(this.maxItems != -1 && (selectedElements.length >= this.maxItems))
			{
				this.fire('item-overFlow');
				return true;
			}


			if(typeof fstat == 'string')
				fstat == { url : fstat };

			// prevent duplicates
			if(selectedElements.filter(function(el) { return el.item.url == fstat.url }).length)
			{
				this.fire('item-duplicate', fstat);
				return false;
			}

			newEl = document.createElement("ir-filebrowser-item");
			newEl.item = fstat;
			newEl.addEventListener('item-click', // open dialog to relPath if available
				function (e) {
					if(e.detail.item.relPath)
						that.relPath = e.detail.item.relPath;
					that.showDialog();
				});
			Polymer.dom(this).appendChild(newEl);

			this._updateValue();

			return true;
		},

/**
Open dialog in prompt mode - i. e. Select and Cancel buttons are shown instead of Close.
@param (Function) callback(value, extraData)
*/
		prompt : function(callback) {
			if(!this.promptMode)
				throw new Error('ir-filebrowser is not in prompt mode. Set the prompt-mode attribute to enable it.');

			this.promptCallback = callback;
			this.showDialog();
		},

/**
Close dialog, call the callback with `this.value` and forget the callback.
*/
		promptSelect : function() {
			//console.log('prompt selected!')

			if(!this.promptCallback)
				return;

			this._scrollAfterSelect = this.$.scrollableFiles.scrollTop;
			var selectedFiles = this.value.split(',');
			if(selectedFiles.length > 1) {

				for (i = 0; i < selectedFiles.length; i++) {

					var x = selectedFiles[i].match(/\.([^\.]+)$/)[1];
					if (x && x.match(/^(mp4|ogg|webm|ogv)$/i)) {
						alert('You may currently only insert multiple images or a single video');
						this.showDialog();
						return;
					}
					else{
						this.hideDialog();
					}
				}
			}


			var ext = this.value.match(/\.([^\.]+)$/)[1];

			var i, j;

			if(selectedFiles.length > 1)
			{
				var imgHTML = "",
					oneImgGallery = "";

				for(i = 0; i < selectedFiles.length; i++)
					{
						if(!this.fileCaptions[selectedFiles[i]])
							imgHTML += "<img src='" + selectedFiles[i] + "'>";
						else
							imgHTML += "<div class='caption-wrapper'>" + "<img src='" + selectedFiles[i] + "'>" + "<span class='caption'>" +  this.fileCaptions[selectedFiles[i]] + "</span></div>";

						if(!this.gallery && this.wrapperPromptResult)
							if(!this.fileCaptions[selectedFiles[i]])
								oneImgGallery += this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', "<img src='" + selectedFiles[i] + "'>");
							else
								oneImgGallery += this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', "<div class='caption-wrapper'>" + "<img src='" + selectedFiles[i] + "'>" + "<span class='caption'>" +  this.fileCaptions[selectedFiles[i]] + "</span></div>");
					}

				if(this.gallery)
					this.promptCallback(this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', imgHTML));
				else
					if(this.wrapperPromptResult)
						this.promptCallback(oneImgGallery);
					else
						this.promptCallback(imgHTML);
			}
			else
				if(ext && ext.match(/^(mp4|ogg|webm|ogv)$/i))
					if(!this.meta.caption)
						this.promptCallback("<video controls ><source src='" + this.value + "' type='video/" + ext + "'></video>");
					else
						this.promptCallback("<div class='caption-wrapper'><video controls ><source src='" + this.value + "' type='video/" + ext + "'></video>" + "<span class='caption'>" +  this.meta.caption + "</span></div>");
				else
					if(this.wrapperPromptResult)
						if(!this.meta.caption)
							this.promptCallback(this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', "<img src='" + this.value + "'>"));
						else
							this.promptCallback(this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', "<div class='caption-wrapper'>" + "<img src='" + this.value + "'>" + "<span class='caption'>" +  this.meta.caption + "</span></div>"));
					else
						if(!this.meta.caption)
							this.promptCallback(this.value);
						else
							this.promptCallback("<div class='caption-wrapper'>" + "<img src='" + this.value + "'>" + "<span class='caption'>" +  this.meta.caption + "</span></div>");

			this.hideDialog();
			this.clearSelection();
			this.promptCallback = null;
		},

/**
Close dialog and forget the callback.
*/
		promptCancel : function() {
			this.hideDialog();
			delete this.promptCallback;
		},

/**
Remove specific item from selection. Note: all selected items matching the url will be removed, in case there are duplicates.
@param (Object|String) url or object with .url property
*/
		removeSelection : function(url) {
			var that = this;
			if(typeof url == 'object')
				url = url.url;

			// remove from selection
			this._getSelectionElements()
				.forEach(function(el, i) {
					if(el.item.url == url)
						Polymer.dom(that).removeChild(el);
				});

			// unselect in dialog
			Polymer.dom(this.$.fileItemsList).childNodes
				.forEach(function(el) {
					if (el.is == 'ir-filebrowser-item' && el.item.url == url)
						el.unselect();
			});


			this._updateValue();
		},

		/** Get ir-filebrowser-item content children */
		_getSelectionElements : function() {
			return this.getContentChildren()
					.filter(function(el) { return el.is == 'ir-filebrowser-item'});
		},

		/** Remove all items from selection */
		clearSelection : function() {
			var that = this;
			this._getSelectionElements()
				.forEach(function(el) {
					that.removeSelection(el.item);
				});

			this.value = '';
		},

		renameSelectionElement : function(relPath) {
			var lastUrl = this.renamedFile.lastUrl,
				fName = this.renamedFile.name,
				fstat = this.renamedFile,
				that = this;

			this.ls();

			this._getSelectionElements()
				.forEach(function(el) {
					if(el.item.url == lastUrl) {
						el.item = fstat;
						that.fileName = fName;
					}
				});
		},

		deleteSelectionElement : function() {
			this.ls();
			this.fileName = null;

			for(var i = 0; i < this.deletedFile.length; i++)
				this.removeSelection(this.deletedFile[i]);
		},

		metaChanged : function() {
			this.fire('captionChanged', { caption : this.meta.caption });
		},

		/** Toggles clicked file */
		clickFile : function (e) {

			if(this.selectedDirectory && (this.selectedDirectory !== e.detail))
				this.selectedDirectory.unselect();

			if(e.detail.item.isDirectory) {
				if(!e.detail.isSelected)
				{
					this.fileName = e.detail.item.name;
					this.selectedDirectory = e.detail;
					e.detail.select();
				}
				else
				{
					this.fileName = null;
					e.detail.unselect();
				}

			}
			else
				if (!e.detail.isSelected) {
					if(!this.addSelection(e.detail.item))
						return;

					this.fileName = e.detail.item.name;
					e.detail.select();

					var fileSize = e.detail.item.size/1000 + "Kb";

					this.set('noImage', !e.detail.item.isImage);
					this.set('fUrl',  e.detail.item.isImage ? e.detail.item.url : '' );
					this.set('linkForDownload', e.detail.item.url);

					this.set('fSize', fileSize);

					var date = new Date(e.detail.item.birthtime);
					var options = {
						year: 'numeric',
						month: 'numeric',
						day: 'numeric',
						timezone: 'UTC',
						hour: 'numeric',
						minute: 'numeric',
						second: 'numeric'
					};
					this.set('fDate', date.toLocaleString("en-Us", options));
					this.set('noFile', false);

					var nameReq = path.join(this.relPath + this.fileName);

					
					this.$.getDescription.url = this._getdescriptionUrl.replace(/\/?\[path\]/, nameReq.replace(/-/g, "%2E"));
					this.$.getDescription.generateRequest();
				}
				else {
					this.removeSelection(e.detail.item);
					e.detail.unselect();
					this.fileName = null;
					this.set('noFile', true);
				}

			if (this.autoPreview && !this.promptMode)
				this.hideDialog();

			this._updateValue();
			Polymer.dom.flush();
		},

		showDescription : function() {
			if(!this.fileDescription){
				this.hasInfo = false;
				this.set("fName", this.fileName);
				this.set("meta.caption", "");
				this.set("meta.description", "");
				this.set("meta.alt", "");
				this.set("meta.height", "");
				this.set("meta.width", "");
				this.set("fileId", "");
				this.fileCaptions[this.fUrl] = "";
			}
			else {
				this.hasInfo = true;
				this.set("fName", this.fileDescription.fileName);
				this.set("meta.caption", this.fileDescription.title);
				this.set("meta.description", this.fileDescription.content);
				this.set("meta.alt", this.fileDescription.alt);
				this.set("meta.height", this.fileDescription.height);
				this.set("meta.width", this.fileDescription.width);
				this.set("fileId", this.fileDescription.id);
				this.fire('captionChanged', { caption : this.meta.caption });
				this.fileCaptions[this.fUrl] = this.meta.caption;
			}
		},

		updateDescription : function() {
			this.$.updateFile.body = { id : this.fileId, title : this.meta.caption, content : this.meta.description, alt : this.meta.alt };
			this.$.updateFile.contentType = "application/x-www-form-urlencoded";
			this.$.updateFile.url = this._updatefileUrl;
			this.$.updateFile.generateRequest();
		},

		/** Updates .value for ir-reflect-to-native-behavior */
		_updateValue : function() {
			var that = this;

			this.async(function() {
				that.value = this._getSelectionElements().map(function(s) { return s.item.url }).join(',');
				if(this.hideAfterUpdate)
				{
					this.hideAfterUpdate = false;
					this.promptSelect();
				}
			});
		},

		dblclickFile : function (e) {
			// the following is problematic because single click handler unselects the file, look into it.
			if(this.promptMode)
			{
				this.hideAfterUpdate = true;
				this.clickFile(e);
			}
		},
		dblclickDirectory : function (e) {
			this.set('isLoaded', true);
			this.ls(e.detail.item.name);
			if(this.maxItems !== 1)
				this.clearSelection();
		},
		unselect : function (e) {
			//this.preview = true;
		},

		setupUploader: function() {
			var that = this;
			if(!this.setupDone)
			{
				this.$.fileUploader.setupDrop(this.$.dialog);
				//this.$.fileUploader._fileClick = function () {}; //setupDrop(this.$.selectorContainer);
				this.setupDone = true;
			}
		},

		filesChanged : function() {
			if(!this.firstUpload)
			{
				this.set('isUploadingFiles', false);
				if(this.$.fileUploader.files.length > 0)
					this.firstUpload = true;
			}

			if(this.firstUpload)
			{
				this.set('isUploadingFiles', !!this.$.fileUploader.files.length);
				this.set('uploadedFiles', this.$.fileUploader.files.length);
				console.log('files changed:', this.$.fileUploader.files.length, this.isUploadingFiles);
				if(!this.$.fileUploader.files.length && !this.isUploadEnds)
				{
					var that = this;
					this.ls();
					this._filesBeforeUpload = {};
					this.files.forEach(function(f) {
						that._filesBeforeUpload[f.name] = 1;
					});
					this.isUploadEnds = true;
				}
			}
		},

		// selects just uploaded file(s); called on successful upload, then on every displayLoadedFiles, but practically works only after upload
		lsAfterUpload : function() {

			if(this._filesBeforeUpload && this.isUploadEnds)
			{
				var diff = [],
					that = this,
					toSelect = [];
				Array.prototype.forEach.call(Array.prototype.reverse.call(this.$.fileItemsList.children),
					function(fi) {
						if(fi.is != 'ir-filebrowser-item')
							return;

						if(!that._filesBeforeUpload[fi.item.name]) // in no particular order. the good thing is that we won't select more than we can.
							toSelect.push(fi);

					});

				var selectedElements = that._getSelectionElements();

				/*if(that.maxItems > 0 && (selectedElements.length + toSelect.length > that.maxItems))
					that.clearSelection(); */

				//toSelect.forEach(function(fi) { that.clickFile({ detail : fi}) });
				that.selectUploadedItems(toSelect);

				that._filesBeforeUpload = null;

				this.fire('toast', 'upload is complete');
				this.isUploadEnds = false;
			}
		},

		selectUploadedItems : function(items) {
			var that = this;

			if(this.$.dialog.opened)
				{
					items.forEach(function(fi) {
						that.clickFile({ detail : fi});
					});
					this.backgroundUpload = false;
				}
			else
				{
					this.backgroundUpload = true;
					this.backgroundItems = items;
				}
		},

		showDialog : function(relPath) {
			// Polymer.dom.flush();
			var that = this;
			setTimeout(function() {
				that.tableselected = "0";
				that.set('isLoaded', true);
				that.$.dialog.open();
				that.ls(relPath);
				if(that.backgroundUpload)
					that.selectUploadedItems(that.backgroundItems);
				that.async(function() {
					that.refitDialog()
				});

				if(that._scrollAfterSelect){
					setTimeout(function() {
						that.$.scrollableFiles.scrollTop=this._scrollAfterSelect;

						that._scrollAfterSelect = null;
					}.bind(this), 200);
				};
			}, 300);

		},

		hideDialog : function (e) {
			this.$.dialog.close();
		},


		ready: function() {
			var that = this;


			if(this.fullView)
			{
				this.promptMode = "true";
				this.fullViewMode = "true";
				this.showDialog();
			}

			if(this.archiveMode)
			{
				//this.promptMode = true;
				this.showDialog();
				this.$.dialog.style.margin = 0;
				this.$.dialog.noCancelOnOutsideClick = true;
				this.$.dialog.noCancelOnEscKey = true;
			}

			if(this.promptMode)
			{
				if(!this.fullView)
					this.$.dialog.modal = true;
				//this.$.dialog.noCancelOnOutsideClick = false;
				this.autoPreview = false; // until there's a better way
			}

			this.$.pocketDrawer.drawerWidth = "35%";

			this._urlsChanged();
			this.setupUploader();

			// this.$.scrollableDialog.assignParentResizeable(this.$.dialog);

			this.async(function() { // wait for ir-filebrowser-items to initialize
				// collect values, remove and add again
				var preselection = [];
				that.getContentChildren()
					.forEach(function(el) {
						if(el.is != 'ir-filebrowser-item')
							return;

						preselection.push(el.item);
					});

				that.clearSelection();

				that.async(function() {
					preselection.forEach(function(item) {
						that.addSelection(item);
					});
				});
			});
		},

		_urlsChanged : function() {
			var that = this;

			this._lsUrl = path.join(this.host, this.lsUrl);

			"makedirUrl,findfileUrl,renameUrl,deletefileUrl,postUrl,getdescriptionUrl,updatefileUrl,searchbydescUrl"
			.split(',')
			.forEach(function(f) {
				if(that[f])
					that["_" + f] = path.join(that.host, that[f]);
			});
		},

		properties : {
			host : 				{ type : String, value : "", notify : true },
			lsUrl :				{ type : String, value : "", notify : true },
			lsRootUrlPath :		{ type : String, value : "/" },
			lsStatsPath :		{ type : String, value : "" },
			postUrl :			{ type : String, value : "", notify : true },

			postFields :		{ type : Object, value : { path : "" } },

			renameUrl:			{ type : String, value : "", notify : true },
			findfileUrl:		{ type : String, value : "", notify : true },
			makedirUrl:			{ type : String, value : "", notify : true },
			deletefileUrl:		{ type : String, value : "", notify : true },
			getdescriptionUrl:  { type : String, value : "", notify : true },
			updatefileUrl:		{ type : String, value : "", notify : true },
			searchbydescUrl: 	{ type : String, value : "", notify : true },

/* currently browsed path, relative to lsRootUrlPath */
			relPath : 			{ type : String, value : "/" },
			loadedData	:		{ type : Object },
			listProperty	:	{ type : String, notify : true },
			rootUrlProperty	:	{ type : String, notify : true },

			selected	:		{ type : Array, notify : true },
			selectedItems	:	{ type : Array, value : [], notify : true },

			/** Maximum number items that may be selected. Default -1 means unlimited. */
			maxItems :			{ type : Number, value : -1, notify : true },

			autoPreview :		{ type : Boolean },

			cloneToNative :		{ type : Boolean,	value : true },
			name :				{ type : String, value : "" },

			showDirectories :	{ type : Boolean, value : true },
			showFiles :			{ type : Boolean, value : true },
			resize :			{ type : Boolean, value : true },

			backgroundUpload : 	{ type : Boolean, value : false },
			backgroundItems : 	{ type : Object },
			isUploadEnds : 		{ type : Boolean, value : false },
			firstUpload : 		{ type : Boolean, value : false },
			wrapperPromptResult:{ type : String, notify : true },
			dir : 				{ type : String, notify : true },
			currentTime : 		{ type : Number, value : 0 },
			limit : 			{ type : Number, value : 20 },
			loadedFiles : 		{ type : Array, value : [] },
			isLoaded : 			{ type : Boolean, value : true },
			uploadedFiles : 	{ type : Number, value : 0 },
			loadedDirectories : { type : Array, value : [] },
			isFirstTimeOpened : { type : Boolean, value : true },
			gallery : 			{ type : Boolean, value : false },
			renameFiles :		{ type : Boolean, value : false },
			tableselected :		{ type : String, notify : false },
			tempselected :		{ type : String, notify : false },
			inputValue :		{ type : String },
			fileName : 			{ type : String },
			filesList : 		{ type : Array , value : []},
			selectedDirectory : { type : Object },
			fullView :			{ type : Boolean} ,
			fullViewMode :		{ type : Boolean, value : false },
			archiveMode : 		{ type : Boolean },
			fileId :			{ type : Number },
			hasInfo : 			{ type : Boolean },
			noFile : 			{ type : Boolean, value : true},
			meta : 				{ type : Object, value : {
								caption : "",
								description : "",
								alt : "",
								width : "",
								height : ""}},
			fileCaptions :		{ type : Array, value : {} },

			isUploadingFiles : { type : Boolean },

			/** Enables prompt mode: sets maxItems to 1, hides selection, replaces Close button with Cancel and Select. */
			promptMode :			{ type : Boolean, value : false },

			/** Open by default - precursor to inline mode. */
			opened : { type : Boolean, value : false }
		},

		observers: [
			'_urlsChanged(host, lsUrl, postUrl, renameUrl, findfileUrl, makedirUrl, deletefileUrl, getdescriptionUrl, updatefileUrl, searchbydescUrl)'
		],
		behaviors: [
			ir.ReflectToNativeBehavior
		],
	});


	Polymer(
	{
		is : 'ir-filebrowser-item',

/*
Fired when an item is clicked.
@event item-click
*/
		click : function(ev) {
			this.fire("item-click", this);
		},
/*
Fired when an item is doubleclicked.
@event item-dblclick
*/
		dblclick : function(ev) {
			this.fire("item-dblclick", this);
			ev.stopPropagation();
		},

		/** Select this ir-filebrowser-item */
		select : function() {
			this.$.container.classList.add('selected');
			this.$.container.elevation = "0";
			this.$.container.style.backgroundColor = "#E1E5FB";
			this.$.container.style.color = "#3f51b5";
			this.$.container.style.fontWeight = "bolder";
			this._setIsSelected(true);
		},
		/** Unselect this ir-filebrowser-item */
		unselect : function() {
			this.$.container.classList.remove('selected');
			this.$.container.elevation = "2";
			this.$.container.style.backgroundColor = "";
			this.$.container.style.color = "";
			this.$.container.style.fontWeight = "";
			this._setIsSelected(false);
		},
		properties : {
			/** File Stat object represented by this ir-filebrowser-item */
			item : { type : Object, observer : "_itemChanged", notify : true },
			/** Index of this item in container in its containing ir-filebrowser */
			index : { type : Number },
			/** True if item is selected, false otherwise */
			isSelected : { type : Boolean, readOnly : true },
			/** Url of the selected file */
			url : { type : String,  }
		},
		_itemChanged : function() {
			var item = this.item;

			if(this.url)
				item.url = this.url;

			if(item.url && !item.name)
				item.name = decodeURIComponent(item.url.match(/([^/]+)$/)[1]);
			else if(!item.url && item.name && item.relPath) // if(!item.url)
			{
				item.url = item.rootUrl + item.relPath + encodeURIComponent(item.name);
				console.log('decoded (name) %s -> (url) %s', item.name, item.url);
			}

			if(!item.url && item.name != '..') // should have been provided or constructed by this point
				throw new Error("To initialize an ir-filebrowser-item at least one of either url or (rootUrl and name) must be set.");

			if(!item.ext)
				item.ext = item.isDirectory ? "<dir>" : item.url.match(/([^.]+)$/)[1];

			item.isImage = ['jpeg','jpg','png','gif'].indexOf(item.ext) > -1;

			if(item.isSelected)
				this.select();
			else
				this.unselect();

			this._item = item;
			//this.set('item.isImage', this.item.isImage);

			this.async(function() {
				Polymer.dom.flush();
			});
		},
		ready : function() {
			if(this.url)
			{
				var item = {
					url : this.url
					//ext : this.url.match("([^.]+)$")[1]
				}
				//item.isImage = ['jpg','jpeg','gif','png'].indexOf(item.ext) > -1;

				this.item = item;
			}
		},

		attached : function() {
			this.fire('item-attached');
		}
	});

	function encodeQuery(q)
	{
		if(!q)
			return ""
		return q.split("&").map(function(pair) { var res = pair.split("="); return [res[0], encodeURIComponent(res[1])].join("=") }).join('&');
	}



	// simulate nodejs path for urls
	var path = {
		join : function() {
			var protocol,
				lead = '',
				trail = '';

			protocol = arguments[0].match(/^[^:]+:(\d)*\/\//);

			if(protocol)
			{
				protocol = protocol[0];
				arguments[0] = arguments[0].replace(/^[^:]+:\/\//, '');
			}
			else
			{
				protocol = '';
				lead = arguments[0].match(/^\//) ? '/' : '';
			}

			trail = arguments[arguments.length-1].match(/\/$/) ? '/' : '';

			var join, split;

			split = [].filter.call(arguments, function(p) {
				return p;
			});

			// if there was no protocol now is the time to check if first non-empty argument is an absolute path
			if(!lead && !protocol)
				lead = split[0].match(/^\//) ? '/' : '';

			split = split.map(function(p) {
				return p.split('/');
			});

			join = [].concat.apply([], split).filter(function(p) { return p; }).join('/');


			return protocol + lead + join + trail; // note that `protocol` includes :// in the regex
		}
	};

})();


