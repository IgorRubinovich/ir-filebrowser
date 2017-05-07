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
			// simulate nodejs path for urls
		var path = {
			join : function() {
				var 
					protocol,
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
		}
	
	
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

				if(newSplit[0]!=""){// if relative from rootDir url like "/folder0/folder1"
					while (newSplit.length) // just like node's path.resolve(this.relPath, relPath)
					{
						p = newSplit.shift();
						if (p == '..')
							split.pop();
						else if (p)
							split.push(p);
					};
					this.relPath = split.join('/');
				}else{
					this.relPath = newSplit.join('/');
				}
			}
			else
			{
				if(/\.{2,}/.test(relPath))
				{
					this.status = 403;
					throw new Error("403 Acess forbidden (did you use '..' in requested path?)");

				};

				this.relPath = relPath;
			}

			if(this.relPath)
				this.relPath += '/';

			var reqUrl = this.path.join(this._lsUrl.replace(/\[path\]/, this.relPath)) // the [^:] makes sure the protocol double slash is preserved for absolute urls

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
				localRoot,
				rootUrl,
				statsData,
				files = [],
				that = this,
				directories = [];

			this.loadedFiles = [];
			this.loadedDirectories = [];

			if(!this.loadedData)
			{
				if(this.firstRoot)
				{
					this.$.makedirloader.body = {name : this.rootDir, fpath : ''};
					this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
					this.$.makedirloader.url = this._makedirUrl;
					this.$.makedirloader.generateRequest();

					this.firstRoot = false;

					this.$.loader.url = this._lsUrl.replace(/\[path\]/, this.rootDir).replace(/\/\//, "/");
					this.$.loader.generateRequest();					
				}
				
				return;
			}			

			this.firstRoot = false;

			this.files = [];
			this.directories = [];

			rootUrl = this.path.join(this.host, this.get(this.lsRootUrlPath, this.loadedData));
			statsData = this.get(this.lsStatsPath, this.loadedData).filter(function(stat) { return that.filterValue ? (new RegExp(that.filterValue, "i")).test(stat.name) : true; });

			sorted = statsData.sort(function(x,y) { return (new Date(y.mtime)).getTime() - (new Date(x.mtime)).getTime() });

			for(var i=0; i < sorted.length; i++)
			{
				fstat = sorted[i];

				fstat.rootUrl = rootUrl;
				// fstat.lsRootUrlPath = this.lsRootUrlPath;
				fstat.url = this.path.join(rootUrl.replace(/ /g, '%20'), encodeURIComponent(fstat.name).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/!/, "%21").replace(' ', "%20"));
				fstat.relPath = this.relPath;

				// look for items with same url as in selection and select them in the filebrowser dialog
				this._getSelectionElements()
					.filter(function(el) { return el.id && (el.item.url == fstat.url || el.item.url == this.path.join(document.location.origin, fstat.url)) })
					.forEach(function(el) { fstat.isSelected = true });
				Polymer.dom.flush();

				if(fstat.isDirectory)
					directories.push(fstat);
				else
					files.push(fstat);
			};

			if(this.toSelection)
			{
				this.completeSelection(this, files);
				this.toSelection = false;
			}

			if(this.rootDir)
				localRoot = "/" + this.rootDir + "/";
			else
				localRoot = "";

			if(this.isFirstTimeOpened)
			{
				if(this.dir.match(/\[year\]\[month\]/))
				{
					var date = new Date(),
					year = date.getFullYear(),
					month = date.getMonth() + 1;

					if(month < 10)
						month = "0" + month;					

					if(this.relPath == localRoot)
					{
						for(var i = 0; i < directories.length; i++)
							if(year == directories[i].name)
							{
								this.ls(String(year));
								return;
							}

						this.$.makedirloader.body = {name : year, fpath : this.relPath};
						this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
						this.$.makedirloader.url = this._makedirUrl;
						this.$.makedirloader.generateRequest();

						this.ls(String(year));
						return;

					}
					else
					{
						for(var i = 0; i < directories.length; i++)
							if(month == directories[i].name)
							{
								this.isFirstTimeOpened = false;
								this.ls(String(month));
								return;
							}

						this.$.makedirloader.body = {name : month, fpath : this.relPath};
						this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
						this.$.makedirloader.url = this._makedirUrl;
						this.$.makedirloader.generateRequest();

						this.isFirstTimeOpened = false;
						this.ls(String(month));
						return;
					}
				}
				else
				{
					for(var i = 0; i < directories.length; i++)
						if(this.dir == directories[i].name)
						{
							this.isFirstTimeOpened = false;
							this.ls(this.dir);
							return;
						}

					this.$.makedirloader.body = {name : this.dir, fpath : this.relPath};
					this.$.makedirloader.contentType = "application/x-www-form-urlencoded";
					this.$.makedirloader.url = this._makedirUrl;
					this.$.makedirloader.generateRequest();

					this.isFirstTimeOpened = false;
					this.ls(this.dir);
					return;	
				}
				
			};

			if(this.checkAvailability)
			{
				this.checkAvailability = false;
				return;
			}

			if(!(/^\/?$/.test(this.relPath)) && (this.relPath != localRoot)) // create an '..' directory entry
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
			if(this._files.length + this._directories.length > 0)
				this.isMore = true;
			else
				this.isMore = false;

			if(!this._itemsListenerAttached)
			{
				this._itemsListenerAttached = true;
			}

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
			this.set('isLoading', false);

			that.lsAfterUpload();

			//this.files = res;
		},
		
		loadMoreFilesLs : function(e) {
			if(!e || !e.target)
				return;

			var target = e.target,
				scrollerHeight = target.scrollHeight,
				allFiles = this._files.length + this._directories.length;

			var date = new Date();
			var newtime = date.getMinutes()*60000 +  date.getSeconds()*1000 + date.getMilliseconds();

			if(allFiles < this.limit)
				return; //this.isMore = false;

			if(((scrollerHeight - target.scrollTop <= 600) || e.type == "tap") && allFiles > 0)
			{
				this.push.apply(this, ['directories'].concat(this._directories.splice(0, this.limit)));
				this.push.apply(this, ['files'].concat(this._files.splice(0, (this.directories.length < this.limit ? -1 : 1 ) * (this.directories.length - this.limit))));
			}
		},

		loadMoreFiles : function(e) {
			this.debounce("loadMoreFiles", function () {
				this.loadMoreFilesLs(e);
			}, 200);
		},

		refitDialog : function() {
			this.$.dialog.fitInto = window;		
			
			this.$.dialog.sizingTarget = this.$.dialog;
			
			this.$.dialog.minWidth = "90vw";
			this.$.dialog.refit();

			if(this.fullView) {
				this.$.dialog.fitInto = Polymer.dom(this).parentNode;

				this.$.dialog.refit();
				
				this.$.dialog.style.position = "static";
				this.$.dialog.style.boxShadow = "none";
				this.$.dialog.style.margin = 0;
				this.$.dialog.style.maxWidth = '100%';

				return;
			}
			if(this.archiveMode)
			{
				this.$.dialog.refit();
				
				return;
				
				this.async(function () {

					this.$.dialog.style.position = "";
					this.$.dialog.style.bottom = this.$.dialog.style.top = this.$.dialog.style.left = this.$.dialog.style.right = "0";
					this.$.dialog.style.height = "auto";
					this.$.dialog.style.zIndex = "0";

					Polymer.updateStyles();
					Polymer.dom.flush();
				});

				return;
			}

			//this.$.scrollableFiles.style.minHeight = "70vh";


			return;

			this.async(function() {

				this.$.dialog.fitInto = window;

							this.$.dialog.constrain();

				this.$.dialog.style.position = "fixed";

				this.$.dialog.center();


				
				Polymer.updateStyles();
				Polymer.dom.flush();

				var currentHeight = document.documentElement.clientHeight,
					topTabsHeight = 300,
					bottomButtonsHeight = 0;

			})

			this.$.dialog.style.position = "fixed";
		},

		goHome : function() {
			if(this.dir){
				if(this.dir.match(/\[year\]\[month\]/))
				{
					var date = new Date(),
					year = date.getFullYear(),
					month = date.getMonth() + 1;

					if(month < 10)
						month = "0" + month;
					
					this.ls('/' + year + '/' + month, true);
				}
				else{
					this.ls(this.dir, true);
				}
			}else{
				this.ls('/'+this.rootDir);	
			}
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
			var that = this;

			if(this.searchValue.length > 3)
				setTimeout(function() {
					that.$.searchByDesc.url = that.searchbydescUrl.replace(/\[path\]/, that.searchValue);
					that.$.searchByDesc.contentType = "application/x-www-form-urlencoded";
					that.$.searchByDesc.generateRequest();
				}, 200);

			if(e.code == "Backspace" && this.searchValue == "")
				this.ls();
		},

		listDesire : function() {

			this.splice('files', 0, this.files.length);
			this.splice('directories', 0, this.directories.length);

			if(this.desiredFiles)
				for(var i = 0; i < this.desiredFiles.length; i++)
				{
					this.push('files', this.desiredFiles[i]);
				}

		},

		nothingFound : function() {
			this.splice('filesList', 0);
			this.push('filesList', { name : 'wrong query', content : '', path : '' });
		},

		searchClear : function() {
			this.set('searchValue', "");
			this.ls();
		},

		deleteFile : function() {
			var filesToDelete = this._getSelectionElements(),
				filesList = [];

			if(filesToDelete.length > 0 || this.fileName) {
				if(filesToDelete.length > 0)
					for(var i = 0; i < filesToDelete.length; i++)
						filesList.push(encodeURIComponent(filesToDelete[i].item.name));
				else
					if(this.fileName && this.noFile)
						filesList = [this.fileName];
					
				var askUser = confirm("Are you sure you want to delete " + filesList.join(','));
				if (askUser == true) {
					this.set('noFile', true);
					this.$.deletefileloader.body = {name: filesList, fpath: this.relPath};
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
				alert("Could not delete, entry does not exist or directory not empty.");
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
Select items defined in the array. Previous selection is lost.
@param {Array} selection array of fstat objects or objects with url field, or strings representing urls.
*/
		setSelection : function(selection) {
			this.clearSelection();
			selection.forEach(function(f) { 
				this.addSelection(f); 
			}.bind(this));
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
			{
				this.clearSelection();
				selectedElements = this._getSelectionElements();
			}
			else if(this.maxItems != -1 && (selectedElements.length >= this.maxItems))
			{
				this.fire('item-overFlow');
				return true;
			}


			if(typeof fstat == 'string')
				fstat = { url : fstat };

			// prevent duplicates
			if(selectedElements.filter(function(el) { return el.item.url == fstat.url }).length)
			{
				this.fire('item-duplicate', fstat);
				return false;
			}

			newEl = document.createElement("ir-filebrowser-item");
			newEl.item = fstat;
			newEl.isSelectionItem = true;
			newEl.textSetCover = this.textSetCover;
			
			newEl.addEventListener('item-click', // open dialog to relPath if available
				function (e) {
					if(e.detail.item.relPath)
						that.relPath = e.detail.item.relPath;
					that.showDialog();
				});
			newEl.addEventListener('update-selection',
				function(e) {

					that.$.sortableContent.insertBefore(e.detail, that.$.sortableContent.children[0]);

					that._updateValue();

					return;
				});
			newEl.addEventListener('remove-item', 
				function(e) {
					that.removeSelection(e.detail.item);
					that._updateValue();
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
			// multiple files selected
			{
				var imgHTML = "", t,
					multiImageItems = [], oneImageItems = [];

				for(i = 0; i < selectedFiles.length; i++)
				{
					t = "<img src='" + selectedFiles[i] + "'> ";
					// multi image gallery, no caption
					if(this.gallery)
						if(!this.fileCaptions[selectedFiles[i]])
							multiImageItems.push(this.wrapperPromptNoCaption.replace(/\[content\]/, t));
						// multi image gallery, caption
						else
						{
							//imgHTML += "<div class='caption-wrapper'>" + "<img src='" + selectedFiles[i] + "'>" + "<span class='caption'>" +  this.fileCaptions[selectedFiles[i]] + "</span></div>";
							multiImageItems.push(this.wrapperPromptCaption.replace(/\[content\]/, t).replace(/\[caption\]/, this.fileCaptions[selectedFiles[i]]));
						}
					else
					// multiple single galleries
					{
						// single image, no caption 
						if(!this.fileCaptions[selectedFiles[i]])
						{
							//oneImageItems.push(this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', "<img src='" + selectedFiles[i] + "'>"));
							oneImageItems.push(this.wrapperPromptNoCaption.replace(/\[content\]/, t));
						}
						// single image, caption
						else
						{	
							//t = this.wrapperPromptCaption.replace(/\[content\]/, t);
							//t = t.replace('[caption]', this.fileCaptions[selectedFiles[i]]);
							//<div 
							//oneImageItems.push(this.wrapperPromptResult.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace('[content]', "<img src='" + selectedFiles[i] + "'>" + "<span class='caption'>" +  this.fileCaptions[selectedFiles[i]] + "</span></div>"));
							oneImageItems.push(this.wrapperPromptCaption.replace(/\[content\]/, t).replace(/\[caption\]/, this.fileCaptions[selectedFiles[i]]));
						}
					}
				}


				t = (this.gallery ? items : oneImageItems).join('');
				/*if(this.gallery)
					this.promptCallback(this.wrapperPromptResult.replace(/\[content\]/, imgHTML));
				else
				{
					oneImageItems = oneImageItems.join('');
					//if(this.wrapperPromptResult)
					this.promptCallback(oneImageItems);
					//else
					//	this.promptCallback(imgHTML);
				}*/
				
				this.promptCallback(this.wrapperPromptResult.replace(/\[content\]/, t));
			}
			else
			// one file selected
			{
				t = this.value
				// video
				if(ext && ext.match(/^(mp4|ogg|webm|ogv)$/i))
					t = "<video controls ><source src='" + this.value + "' type='video/" + ext + "'></video>";
				else
					t =  "<img src='" + this.value + "'>"

				if(this.meta.caption)
					t = this[this.meta.caption ? 'wrapperPromptCaption' : 'wrapperPromptNoCaption']
						.replace(/\[content\]/, t).replace(/\[caption\]/, this.meta.caption)
				
				this.promptCallback(this.wrapperPromptResult.replace(/\[content\]/, t));
			}
			this.hideDialog();
			this.clearSelection();
			this.promptCallback = null;
		},

/**
Close dialog and forget the prompt callback.
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
						Polymer.dom(Polymer.dom(el).parentNode).removeChild(el);
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
			return [].slice.call(this.$.sortableContent.children).filter(function(el) { return el.is == 'ir-filebrowser-item' })
			
			//return this.getContentChildren()
			//		.filter(function(el) { return el.is == 'ir-filebrowser-item'});
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
			this.clearSelection();
		},

		metaChanged : function() {
			this.fire('captionChanged', { caption : this.meta.caption });
		},

		triggerMenu : function(e)
		{
			if(this.$.filesNav.hasAttribute('hidden'))
				this.$.filesNav.removeAttribute('hidden');
			else
				this.$.filesNav.setAttribute('hidden', true);
		},

		/** Toggles clicked file */
		clickFile : function (e) {

			if(this.selectedDirectory && (this.selectedDirectory !== e.detail))
				this.selectedDirectory.unselect();

			if(e.detail.item.isDirectory) {
				if(!e.detail.isSelected)
				{
					if(e.detail.item.name !== "..")
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
					//if(!this.addSelection(e.detail.item))
					//	return;

					this.addSelection(e.detail.item)

					this.fileName = e.detail.item.name;
					e.detail.select();

					if(this.mobile && this.showInfo)
						this.$.pocketDrawer.openDrawer();

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

					var nameReq = this.path.join(e.detail.item.relPath + this.fileName);

					this.$.getDescription.url = this.path.join(this._getdescriptionUrl.replace(/\[path\]/, nameReq.replace(/-/g, "%2E")));
					this.$.getDescription.generateRequest();
				}
				else {
					this.removeSelection(e.detail.item);
					e.detail.unselect();
					this.fileName = null;
					this.set('noFile', true);
				}
				

			if(this._activeItem && this._activeItem != e.detail) 
				this._activeItem.isActive = false;

			e.detail.isActive = e.detail.isSelected && !e.detail.item.isDirectory;
			this._activeItem = e.detail.isActive && e.detail || null;

			if(this.autoPreview && !this.promptMode)
				this.hideDialog();

			this._updateValue();
			Polymer.dom.flush();
		},

		showDescriptionError : function() {
			this.showDescription();
		},
		
		showDescription : function(ev) {
			var fd = (ev instanceof Event ? this.fileDescription : ev) || {};

			this.hasInfo = true;
			this.set("fName", fd.fileName || '');
			this.set("meta.title", fd.title || '');
			this.set("meta.caption", fd.caption || '');
			this.set("meta.description", fd.content || '');
			this.set("meta.alt", fd.alt || '');
			this.set("meta.height", fd.height || '');
			this.set("meta.width", fd.width || '');
			this.set("fileId", fd.id || '');
			this.fire('captionChanged', { caption : this.meta.caption });
			this.fileCaptions[this.fUrl] = this.meta.caption;
		},

		afterUpdateDescription : function(ev)
		{
			if(!ev.target.body.id)
				this.$.loader.generateRequest(); // the minimum we can do when file is in directory but not known in db
		},
		
		updateDescription : function() {
			this.$.updateFile.body = { title : this.meta.title, caption : this.meta.caption, content : this.meta.description, alt : this.meta.alt };
			
			if(this.fileId)
				this.$.updateFile.body.id = this.fileId;
			else
				this.$.updateFile.body.fileName = this.meta.fileName || this.path.join(this.relPath, this._activeItem.item.url.split(/\//).pop());

			this.$.updateFile.contentType = "application/x-www-form-urlencoded";
			this.$.updateFile.url = this._updatefileUrl;
			this.$.updateFile.generateRequest();
		},

		/** Updates .value for ir-reflect-to-native-behavior */
		_updateValue : function() {
			var that = this;

			this.async(function() {
				var selectionItems = [].slice.call(this.$.sortableContent.children);				

				this.value = selectionItems.map(function(el, i) { 
					el.selectionOrder = i;
					el.isSingleSelection = false;
					el.isSelected = false;
					return el.item.url;
				}).join(',');
				
				if(selectionItems.length == 1)
					selectionItems[0].isSingleSelection = true;

				this.notifyPath('value');

				if(this.hideAfterUpdate)
				{
					this.hideAfterUpdate = false;
					this.promptSelect();
				}
				
				this.fire('change');
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
			this.set('isLoading', true);
			this.ls(e.detail.item.name);
			//if(this.maxItems !== 1)
			//	this.clearSelection();
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

		makeList : function(e) {
			var fileName = JSON.parse(e.detail.xhr.response)[0].split('/').pop();
				this.uploadedList[fileName] = 1;
		},

		collectFiles : function(e) {
			var file = JSON.parse(e.detail.xhr.response)[0].split('/'),
				fileName = file.pop(),
				filePath = file.join('/'),
				that = this;

			this.collectedFiles[fileName] = fileName;

			setTimeout(function() {
				that.toSelection = true;
				that.$.loader.url = that._lsUrl.replace(/\[path\]/, filePath).replace(/\/\//, "/");
				that.$.loader.generateRequest();		

			}, 200);

		},

		completeSelection : function(context, files) {
			files.forEach(function(item) {
				if(context.collectedFiles[item.name])
					setTimeout(function() {
						context.addSelection(item);
					}, 100);
			});

			this.collectedFiles = {};
		},

		// selects just uploaded file(s); called on successful upload, then on every displayLoadedFiles, but practically works only after upload
		lsAfterUpload : function() {
			this.debounce('lsAfterUpload', function() {
				if(this._filesBeforeUpload && this.isUploadEnds)
				{
					var diff = [],
						that = this,
						toSelect = [];
					Array.prototype.forEach.call(Array.prototype.reverse.call(this.$.fileItemsList.children),
						function(fi) {
							if(fi.is != 'ir-filebrowser-item')
								return;

							if(!that._filesBeforeUpload[fi.item.name] && that.uploadedList[fi.item.name]) // in no particular order. the good thing is that we won't select more than we can.
								toSelect.push(fi);

						});

					//var selectedElements = that._getSelectionElements();
					// this.clearSelection();

					/*if(that.maxItems > 0 && (selectedElements.length + toSelect.length > that.maxItems))
						that.clearSelection(); */

					//toSelect.forEach(function(fi) { that.clickFile({ detail : fi}) });
					that.selectUploadedItems(toSelect);

					that._filesBeforeUpload = null;

					this.fire('toast', 'upload is complete');
					this.isUploadEnds = false;
					this.uploadedList = {};
				}
			}, 300)
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

		browseLocalFiles : function(relPath) {
			this.$.selectionFileUploader._fileClick();
		},
		showDialog : function(relPath) {
			// Polymer.dom.flush();
			
			this._lastSelection = this._getSelectionElements().map(function(el) { return el.item.url });
			
			var that = this;

			that.$.dialog.open();
			
			this.async(function() {
				that.set('isLoading', true);

				//that.$.dialog.sizingTarget = that.$$("#scrollableDialog")

				
				if(that.rootDir && that.firstRoot)
					that.ls(that.rootDir)
				else
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
		
		topLevelKeys : function(e) {
			if(!this.fullView && e.which == 27)
				this.cancelSelectionChanges();
			else
			if(e.keyCode == 8 && e.target.tagName !== "INPUT")
				e.preventDefault();
		},
		
		cancelSelectionChanges : function() {
			this.clearSelection()
			Polymer.dom.flush();
			this._lastSelection.forEach(function(url) { this.addSelection(url) }.bind(this));
			this.hideDialog();
		},
		
		hideDialog : function (e) {
			this.$.dialog.close();
		},

		attached: function() {
			this.$.scrollableFiles.scrollTarget.addEventListener('scroll', this.loadMoreFiles.bind(this));
			this.loadMoreFiles();
			if(this.__hasResizeListener)
				return;
			if(!this.hasAttribute('full-view'))
				window.addEventListener('resize', this.resizeListener.bind(this));
			
			this.__hasResizeListener = true;
			this.$.dialog.notifyResize();
			
			//this.$.pocketDrawer.assignParentResizeable(this.$.mainContainer)
		},
		
		ironAjaxError : function(ev) {
			if(ev.target.is != 'iron-ajax')
				return;
			
			console.warn(ev);
			this.fire("toast", ev)
		},
		
		resizeListener : function() {
			this.cancelDebouncer('resize');
			this.debounce('resize', function() {
				window.requestAnimationFrame(this.refitDialog.bind(this))
			}, 200);
		},

		ready: function() {
			var that = this;

			if(this.dir)
				this.isFirstTimeOpened = true;

			if(this.dir && !this.rootDir)
			{
				this.checkAvailability = true;
				this.ls();
				this.isFirstTimeOpened = true;
			}

			if(this.rootDir)
				{
					this.firstRoot = true;
					this.checkAvailability = true;
					this.ls(this.rootDir);
				}

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

			if(!this.mobile)
				this.$.pocketDrawer.drawerWidth = "33%";
			
			//this.$.pocketDrawer.drawerHeight = "80%";

			this._urlsChanged();
			if(!this.archiveMode)
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
			this._lsUrl = this.path.join(this.host, this.lsUrl);

			"makedirUrl,findfileUrl,renameUrl,deletefileUrl,postUrl,getdescriptionUrl,updatefileUrl,searchbydescUrl"
			.split(',')
			.forEach(function(f) {
				if(this[f])
					this["_" + f] = this.path.join(this.host, this[f]);
			}.bind(this));
		},
		
		_showInfoChanged : function() 
		{
			if(!this.mobile)
				return;
			
			if(this.showInfo)
				this.$.pocketDrawer.openDrawer();
			else
				this.$.pocketDrawer.closeDrawer();
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
			uploadedList : 		{ type : Object, value : {} },
			wrapperPromptResult:{ type : String, notify : true, value : '[content]' },
			wrapperPromptCaption:{ type : String, notify : true, value : '<figure>[content]<figcaption>[caption]</figcaption></figure>' },
			wrapperPromptNoCaption:{ type : String, notify : true, value : '[content]' },
			dir : 				{ type : String, notify : true },
			rootDir : 			{ type : String, notify : true },
			firstRoot : 		{ type : Boolean, value : false },
			checkAvailability : { type : Boolean, value : false },
			collectedFiles : 	{ type : Object, value : {} },
			toSelection : 		{ type : Boolean, value : false }, 
			currentTime : 		{ type : Number, value : 0 },
			limit : 			{ type : Number, value : 20 },
			isMore : 			{ type : Boolean, value : false },
			loadedFiles : 		{ type : Array, value : [] },
			isLoading : 			{ type : Boolean, value : true },
			uploadedFiles : 	{ type : Number, value : 0 },
			loadedDirectories : { type : Array, value : [] },
			isFirstTimeOpened : { type : Boolean, value : false },
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
			showInfo :			{ type : Boolean, value : true, observer : "_showInfoChanged" },

			isUploadingFiles : { type : Boolean },

			/** Enables prompt mode: sets maxItems to 1, hides selection, replaces Close button with Cancel and Select. */
			promptMode : { type : Boolean, value : false },

			/** Open by default - precursor to inline mode. */
			opened : { type : Boolean, value : false },
			
			textCloseSingleButton : { type : String, value : "OK", notify : true },
			textCancelSingleButton : { type : String, value : "Cancel", notify : true },
			textSetCover : { type : String, value : "make cover", notify : true }
		},

		observers: [
			'_urlsChanged(host, lsUrl, postUrl, renameUrl, findfileUrl, makedirUrl, deletefileUrl, getdescriptionUrl, updatefileUrl, searchbydescUrl)',
			'setSelection(selected)'
		],
		behaviors: [
			Polymer.IronFormElementBehavior,
			typeof ir != 'undefined' && ir.ReflectToNativeBehavior
		],
		path : path
	});

	
	Polymer(
	{
		is : 'ir-filebrowser-item',

		properties : {
			/** File Stat object represented by this ir-filebrowser-item */
			item : { type : Object, observer : "_itemChanged", notify : true },
			/** Index of this item in container in its containing ir-filebrowser */
			index : { type : Number },
			/** True if item is selected, false otherwise */
			isSelected : { type : Boolean, readOnly : true },
			/** Url of the selected file */
			url : { type : String,  },
			/** 
				True when item is in the selection view (usually embedded in a form). If true add a radiobutton to choose main (first) item in selection of ir-filebrowser. 
				Note this is different from a selected (active) item inside the ir-filebrowser dialog.
			*/
			isSelectionItem : { type : Boolean, value : false, notify : true },
			radioButton : { type : Object, notify : true },
			selectionOrder : { type : Number, value : -1, notify : true },
			isRadioHidden : { type : Boolean, computed : '_radioHidden(selectionOrder,isSelectionItem,isAttached)', notify : true },
			isSingleSelection : { type : Boolean, value : true, notify : true },

			isAttached : { type : Boolean, value : false, notify : true },
			isActive : { type : Boolean, value : false, notify : true },
		
			noCheckbox : { type : Boolean, value : false }
		},

/*
Fired when an item is clicked.
@event item-click
*/
		click : function(ev) {
			if(ev.target.tagName == "IRON-ICON")
				this.fire('remove-item', this);
			else
			{
				if(this._doubleClick && new Date().getTime() - this._doubleClick < 300)
					return this.fire("item-dblclick", this)

				this._doubleClick = new Date().getTime()
				
				// this.set("isActive", this.isSelectionItem && !this.isActive);

				this.fire("item-click", this);			
			}
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
			//this.$.container.elevation = "0";
			/*this.$.container.style.backgroundColor = "";
			this.$.container.style.color = "#3f51b5";
			this.$.container.style.fontWeight = "bolder";*/
			this._setIsSelected(true);
		},
		/** Unselect this ir-filebrowser-item */
		unselect : function() {
			this.$.container.classList.remove('selected');
			//this.$.container.elevation = "2";
			/*this.$.container.style.backgroundColor = "";
			this.$.container.style.color = "";
			this.$.container.style.fontWeight = "";*/
			this._setIsSelected(false);
		},
		_checkboxHidden : function() {
			return this.isSelectionItem || !this.isSelected || !this.item || this.item.isDirectory;
		},
		_radioHidden : function() {
			return !this.isSelectionItem || this.selectionOrder < 1;
		},
		_itemChanged : function() {
			var item = this.item, url;

			if(this.url)
				url = this.url;

			if(item.url && !item.name)
				item.name = decodeURIComponent(item.url.match(/([^/]+)$/)[1]);
			else if(!item.url && item.name && item.relPath) // if(!item.url)
			{
				url = this.path.join(item.rootUrl,encodeURIComponent(item.name)); // item.relPath,
				console.log('decoded (name) %s -> (url) %s', item.name, item.url);
			}

			if(url)
				item.url = url;
			
			if(!item.url && item.name != '..') // should have been provided or constructed by this point
				throw new Error("To initialize an ir-filebrowser-item at least one of either url or (rootUrl and name) must be set.");

			if(item.url)
				item.url = resolveUrl(item.url);
				
			if(!item.ext)
				item.ext = item.isDirectory ? "<dir>" : item.url.match(/([^.]+)$/)[1];

			item.isImage = /jpeg|jpg|png|gif/i.test(item.ext);

			item.isOther = !(item.isImage || item.isDirectory);

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
		fireUpdate : function(e) {
			if(e.currentTarget.checked)
				this.fire('update-selection', this);
			this.$.radioButton.checked = false;
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

		detached : function() {
			this.set("isAttached", false);
			console.log('detached!')
		},
		attached : function() {
			this.radioButton = this.$.radioButton;
			this.fire('item-attached');
			this.set("isAttached", true);
		},
		path : path
	})

	function encodeQuery(q)
	{
		if(!q)
			return ""
		return q.split("&").map(function(pair) { var res = pair.split("="); return [res[0], encodeURIComponent(res[1])].join("=") }).join('&');
	}


	// new URL(url) inside iron-image sometimes for some reason fails to intialize relative urls.
	// this method to the rescue - resolving url into absolute
	var _urlresolver = document.createElement('a');
	var resolveUrl = function(url) {
		_urlresolver.href = url;
		return _urlresolver.href;
	}

	


})();


