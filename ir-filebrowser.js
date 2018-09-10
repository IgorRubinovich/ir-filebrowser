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
			matchProtocol : function(p) {
				return p.match(/^([^:]+:(\d)*)?\/\//) || "";
			},
			
			normalize : function normalize(p) {
				var protocol = path.matchProtocol(p) || "";
				return protocol + (protocol ? p.replace(protocol, "") : p).replace(/\/+/g, "/");
			},
			join : function join() {
				var protocol,
					args = [].slice.call(arguments),
					protocol;

				while(args.length && !args[0])
					args.shift();

				while(args.length && !args[args.length - 1])
					args.pop();
				
				if(!args[0])
					return "";
				
				protocol = path.matchProtocol(args[0]);

				if(protocol)
				{
					protocol = protocol[0];
					args[0] = "";
					while(args.length && !args[0])
						args.shift();
				}

				return protocol + path.normalize(args.join('/'));
			}
		};
	
	
	Polymer({
		is : 'ir-filebrowser',

		/**
		  * cd to last successful (hopefully) directory
		*/
		revertLs : function()
		{
			if(this._revertLsAttempts > 3 && this.lastError)
				return; // giving up or else we cango on for a long while

			this._revertLsAttempts = (this._revertLsAttempts || 0) + 1
			
			if(this.oldRelPath == this.relPath)
				return;
			
			this.olderRelPath = this.oldRelPath;
			
			if(this.oldRelPath == '/') 
				this.oldRelPath = '';
			
			if(this.olderRelPath != this.relPath && this.oldRelPath != this.relPath)
				this.ls(this.oldRelPath, true);
			
		},

		/**
		  * Loads list of files at location relative to the this.relPath
		  *
		  * @method ls
		*/
		ls : function(relPath, abs)
		{
			this.oldRelPath = this.relPath;
			
			if(typeof relPath !== 'string')
				relPath  = "";

			if(relPath)
				this.set("filterValue", "");

			if(!abs) {
				var p, split, newSplit;
				split = (this.relPath || "").split('/');
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
				}
				else
					this.relPath = newSplit.join('/');
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
			
			this.relPath = path.normalize(formatTemplateVars(this.relPath));
			
			var reqUrl = this.path.join(formatTemplateVar(this._lsUrl, "path", this.relPath)) // the [^:] makes sure the protocol double slash is preserved for absolute urls

			if(this._lsUrl == reqUrl)
				reqUrl += this.relPath; //this.host + reqUrl; error!

			this.$.loader.url = reqUrl;
			// console.log("will ls:" + reqUrl)
			this.cancelDebouncer('ls');
			
			if(this.opened || this.firstUpload)
				this.debounce('ls', function() {
					console.log("actual ls:" + reqUrl)
					this.$.loader.generateRequest();
				}, 100);

				
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
				split,
				sorted,
				localRoot,
				rootUrl,
				statsData,
				files = [],
				that = this,
				directories = [];

			if(!this.loadedData)
				return;
				
			this.loadedFiles = [];
			this.loadedDirectories = [];

			this._didLs = true;
			

			//this.files = [];
			this.directories = [];

			rootUrl = this.path.join(this.host, this.get(this.lsRootUrlPath, this.loadedData));
			this._rootUrl = rootUrl;
			statsData = (this.get(this.lsStatsPath, this.loadedData) || []).filter(function(stat) { return that.filterValue ? (new RegExp(that.filterValue, "i")).test(stat.name) : true; });

			sorted = statsData.sort(function(x,y) { return (new Date(y.mtime)).getTime() - (new Date(x.mtime)).getTime() });

			this.skip = 0;

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

			if(this.rootDir)
				localRoot = this.path.join("/", this.rootDir, "/");
			else
				localRoot = "";


			if(this.checkAvailability)
				this.checkAvailability = false;
				//return;
			
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
			//this.upFiles = files;

			this.set('directories', this._directories.splice(0, this.limit));
			
			// set up pager
			this._lsPager = this._filePager(files);
			this._gentlySetFiles(this._lsPager.next().value);

			if(!/^\//.test(this.relPath))
				this.set("relPath", "/" + this.relPath)

			split = this.relPath.split("/").filter(function(d) { return d });
			
			this.splitRelPath = split.map(function(d, i) { return { name : d, path : "/" + split.slice(0, i + 1).join("/") + "/" } });
			this.splitRelPath.unshift({ name : "/", path : "\/" });
			if(this.splitRelPath[1]) this.splitRelPath[1].path = this.splitRelPath[1].path.replace(/^\//, "")
		
			this.notifyPath("splitRelPath")
			Polymer.dom.flush();
			this.set('isLoading', false);

			this.lsIfAfterUpload();
			
			//this.files = res;
		},
		
		_loadMoreFilesLs : function(min) {
			var next = this._lsPager.next(min);
			this._gentlySetFiles(next.value);
			return next.done;
		},
		
		loadMoreFilesLs : function(e) {
			if(!e || !e.target)
				return;

			var target = e.target,
				scrollerHeight = target.scrollHeight;

			if(scrollerHeight - target.scrollTop <= 600)
				this._loadMoreFilesLs();
		},
		
		loadMoreFilesDesc : function(e) {
			
		},

		loadMoreFiles : function(e) {
			this.cancelDebouncer("loadMoreFiles");		
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
				this.$.dialog.style.zIndex = "0";

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
					
					this.ls(path.join('/', year, month), true);
				}
				else{
					this.ls(this.path.join(this.rootDir, this.dir).replace(/\/$/, ''), true);
				}
			}else{
				this.ls(path.join('/', this.rootDir));
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

			this.cancelDebouncer("typing-search");
			this.debounce("typing-search", function() {
				var q = this.searchValue.trim();
				if(!q)
					this.ls();
			
				if(q.length < 3)
					return;

				that.$.searchByDesc.url = that.searchbydescUrl.replace(/\[path\]/, q);
				that.$.searchByDesc.contentType = "application/x-www-form-urlencoded";
				that.$.searchByDesc.generateRequest();
			}, 300)
		},
		
		listDesire : function() {
			this._gentlySetFiles([]);
			this.set('directories', []);

			if(typeof this.desiredFiles != 'object')
				return
			
			this.$.scrollableFiles.scrollTop = 0;

			/*for(var i = 0; i < this.desiredFiles.length; i++)
				this.push('files', this.desiredFiles[i]);
			*/
			this._lsPager = this._filePager(this.desiredFiles);
			this.set('files', this._lsPager.next().value)
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
			var filesToDelete = Array.prototype.slice.call(this.$.fileItemsList.children).filter(function(i) { return i.isSelected }),
				filesList = [];

			if(filesToDelete.length > 0 || this.fileName) {
				if(filesToDelete.length > 0)
					filesList = filesToDelete.map(function(f) { return encodeURIComponent(f.item.name) });
				else
					if(this.fileName && this.noFile)
						filesList = [this.fileName];
					
				var askUser = confirm("Are you sure you want to delete " + filesList.join(', '));
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
			this.ls(e.model.item.path, true);
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
			Polymer.dom.flush()
			selection = selection || this.selection || [];
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
				selectedElements = [];
			}
			else if(this.maxItems != -1 && (selectedElements.length > this.maxItems))
			{
				this.fire('item-overFlow');
				return true;
			}


			if(typeof fstat == 'string')
				fstat = { url : fstat };

			if(this.opened)
				// select in dialog
				this.forAllFileItemsInDialog(function(el, ctrl) {
					console.log("selected: %s item url: %s looking for: %s", el.item.isSelected, el.item.url, fstat.url);
					if (el.item.url == fstat.url)
					{
						el.select();
						ctrl.stop();
					}
				});
			
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
			this.clearSelection()
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

			var ext = (this.value ||  '').match(/\.([^\.]+)$/)[1];

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
							multiImageItems.push(this.wrapperPromptCaption.replace(/\[content\]/, t).replace(/\[caption\]/, this.fileCaptions[selectedFiles[i]]));
					else
					// multiple single galleries
					{
						// single image, no caption 
						if(!this.fileCaptions[selectedFiles[i]])
							oneImageItems.push(this.wrapperPromptNoCaption.replace(/\[content\]/, t));
						// single image, caption
						else
							oneImageItems.push(this.wrapperPromptCaption.replace(/\[content\]/, t).replace(/\[caption\]/, this.fileCaptions[selectedFiles[i]]));
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
			this.forAllFileItemsInDialog(function(el) {
				if (el.item.url == url)
					el.unselect();
			});

			this._updateValue();
		},
		
		forAllFileItemsInDialog : function(f) {
			var i, all = Polymer.dom(this.$.fileItemsList).childNodes,
				stop = false,
				ctrl = { stop : function() { stop = true } }
			for(i = 0; (el = all[i]) && !stop; i++) 
				if (el.is == 'ir-filebrowser-item')
					f.call(this, el, ctrl);
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
			this.set("hideFilesNav", !this.hideFilesNav);
			return;
			
			if(this.$.filesNav.hasAttribute('hidden'))
			{
				this.$.filesNav.removeAttribute('hidden');
				this.$.scrollableFiles.setAttribute('hidden', true);
			}
			else
			{
				this.$.filesNav.setAttribute('hidden', true);
				this.$.scrollableFiles.removeAttribute('hidden');
			}
		},
		
		_hideFilesNav : function(mobile,hideFilesNav) { return mobile && hideFilesNav; },
		_hideDrawerPanel : function(mobile,hideFilesNav) { return mobile && !hideFilesNav; },

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

					//if(this.mobile && this.showInfo)
					//	this.$.pocketDrawer.openDrawer();

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

					var nameReq = this.path.join(e.detail.item.relPath, this.fileName).replace(/-/g, "%2E");

					this.$.getDescription.url = this.path.join(formatTemplateVar(this._getdescriptionUrl, "path", nameReq));
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
		},

		setupUploader: function() {
			var that = this;
			if(!this.setupDone)
			{
				this.$.fileUploader.setupDrop(this.$.dialog);
				this.$.selectionFileUploader.setupDrop(this.$.selectionPreview);
				//this.$.fileUploader._fileClick = function () {}; //setupDrop(this.$.selectorContainer);
				this.setupDone = true;
			}
		},

		filesChanged : function(ev) {
			// Any reason to proceed?
			if((!this.isUploadingFiles || ev.target != this.$.fileUploader) && (!ev.target.files || !ev.target.files.length))
				return;
			
			// If files landed on another uploader, move files from selection uploader to main uploader, than work with it
			if(ev.target.files && ev.target != this.$.fileUploader)
			{
				this.$.fileUploader.set("files", ev.target.files.concat(this.$.fileUploader.files || []))
				ev.target.files = [];
				return;
			}
			
			var done, fileUploader = this.$.fileUploader;
			
			// start uploading, reset upload flags
			// if a file is added during upload it's queued (when dropped on $.fileUploader queing is done internally, otherwise by the concat above)
			if(!this.firstUpload)
			{
				this.set('isUploadingFiles', false);
				if(!fileUploader.files.length)
					return;

				Array.prototype.slice.call(this.$.fileItemsList.children).filter(function(i) { return i.isSelected })
					.map(function(f) { return f.item.name })
					.forEach(function(fn) { this.uploadedList[fn] = Object.keys(this.uploadedList).length }.bind(this));

				this._failedUploads = [];
				this.firstUpload = true;

				this.uploadedList = [];

				this._selectionBeforeUpload = this.getCurrentSelection();
				
				this.set("searchValue", "");
			}

			// update upload flags
			done = !fileUploader.files.length || !fileUploader.files.filter(function(f) { return !f.complete && !f.error }).length;

			this.set('isUploadingFiles', !done);
			this.set('uploadedFiles', done ? "" : (this.uploadedList.length + 1) + "/" + (this.uploadedList.length + fileUploader.files.length)); // this is purely for humans info
			
			// last iteration, no more files to upload; run ls, reselect previously both selected and freshly uploaded files
			if(done)
			{
				this.ls();
				this.firstUpload = false;
			}
		},

		makeUploadedList : function(e) {
			// this.$.fileUploader.files = this.$.fileUploader.files.indexOf(e.detail.file);
			var fileName = JSON.parse(e.detail.xhr.response)[0].split('/').pop();
			this.uploadedList.push(fileName);
		},

		processUploadError : function(e) {
			console.log(e);
			this._failedUploads.push(e.detail.file.name);
			
			const status = e.detail.xhr.status;
			const message = this.getAttribute('text-error-' + status) || this.textErrorUploading;
			
			this.$.toast.show({text: message.replace("text-[status]", status).replace("[files]", this._failedUploads.join(', ')), duration: 3000})
			
			this.xhrError(e);
		},
		
		// selects just uploaded file(s); called on successful upload, then on every displayLoadedFiles, but practically works only after upload
		lsIfAfterUpload : function() {
			if(!this.get("uploadedList.length"))
				return 
			this.cancelDebouncer('lsIfAfterUpload');
			this.debounce('lsIfAfterUpload', function() {

				var newSelection = this._selectionBeforeUpload.concat(this.uploadedList.map(function(path) { return resolveUrl(this.path.join(this._rootUrl, path)) }.bind(this)).reverse())
				
				if(this.maxItems > 0)
					newSelection = newSelection.slice(newSelection.length - this.maxItems, newSelection.length)
				
				this.setCurrentSelection(newSelection);
				this._selectionBeforeUpload = [];
				this.uploadedList = [];
				this.fire('toast', this.textUploadComplete);

			}, 300)
		},

		selectUploadedItems : function(items) {
			var remaining = Object.assign([], items);
			
			if(this.$.dialog.opened)
				items.forEach(function(fi) {
					this.clickFile({ detail : fi});
				}.bind(this))
			else
				items.forEach(function(fi) { this.addSelection(fi); });
		},

		browseLocalFiles : function(relPath) {
			this.$.selectionFileUploader._fileClick();
		},
		
		setCurrentSelection : function(arr) { // arr of objects with .url
			if(this.maxItems >= 0)
				arr = arr.slice(0, this.maxItems);
			
			if((this.get("files.length") || 0) < arr.length)
				this._loadMoreFilesLs(arr.length);

			this.clearSelection();
			
			this.cancelDebouncer("setCurrentSelection");
			this.debounce("setCurrentSelection", function() {
				arr.forEach(function(url) { this.addSelection(url); }.bind(this));
			}, 100);
			
			this._updateValue();
		},
		
		getCurrentSelection : function() {
			return this._getSelectionElements().map(function(el) { return el.item.url });
		},
		
		showDialog : function(relPath) {
			// Polymer.dom.flush();
			
			this._lastSelection = this.getCurrentSelection();

			var that = this;

			that.$.dialog.open();
			
			this.async(function() {
				this.set('isLoading', true);

				//that.$.dialog.sizingTarget = that.$$("#scrollableDialog")

				
				if(typeof relPath == 'string')
					this.ls(relPath)
				else if(this.relPath)
					this.ls();
				else
					this.ls(this.path.join(this.rootDir || '', this.dir || ''))
				
				this.async(function() {
					this.refitDialog()
				});

				if(this._scrollAfterSelect)
					this.async(function() {
						this.$.scrollableFiles.scrollTop = this._scrollAfterSelect;

						this._scrollAfterSelect = null;
					}, 200);
				
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
			this.setCurrentSelection(this._lastSelection);
			this.hideDialog();
		},
		
		hideDialog : function (e) {
			this.$.dialog.close();
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

		ready : function() {
			if(this.dir)
				this.isFirstTimeOpened = true;

			this.relPath = this.path.join(this.rootDir, this.dir);
			this._filePager = filePager(this.limit || 20)		
		},
		
		attached: function() {
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
			
		//},


		//attached: function() {
			this.$.scrollableFiles.addEventListener('scroll', this.loadMoreFiles.bind(this));
			// this.loadMoreFiles();
			
			if(this.__hasResizeListener)
				return;
			if(!this.hasAttribute('full-view'))
				window.addEventListener('resize', this.resizeListener.bind(this));
			
			this.__hasResizeListener = true;
			this.$.dialog.notifyResize();
			
			this.ls()
			//this.$.pocketDrawer.assignParentResizeable(this.$.mainContainer)
		},
		
		
		_dirsChanged : function() {
			if(this._didLs)
				return;

			this.relPath = this.path.join(this.rootDir, this.dir);
		},
		
		_urlsChanged : function() {
			this._lsUrl = this.path.join(this.host, this.lsUrl);

			"makedirUrl,findfileUrl,renameUrl,deletefileUrl,postUrl,getdescriptionUrl,updatefileUrl,searchbydescUrl"
			.split(',')
			.forEach(function(f) {
				if(this[f])
					this.set(["_" + f], this.path.join(this.host, this[f]));
			}.bind(this));
			
			this.ls();
		},
		
		_showInfo : function() 
		{
			if(!this.mobile)
				return;
			
			if(this.$.pocketDrawer.selected == 'drawer')
				this.$.pocketDrawer.closeDrawer();
			else
				this.$.pocketDrawer.openDrawer();
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
			
			selected	:		{ type : Array, notify : true, observer : "setSelection" },
			selectedItems	:	{ type : Array, value : function() { return [] }, notify : true },

			/** Maximum number items that may be selected. Default -1 means unlimited. */
			maxItems :			{ type : Number, value : -1, notify : true },

			/** Upload files "synchronously" one by one, thus preserving order and reducing load on the server at the cost of speed */
			sync :				{ type : Boolean },
			
			autoPreview :		{ type : Boolean },

			cloneToNative :		{ type : Boolean,	value : true },
			name :				{ type : String, value : "" },

			showDirectories :	{ type : Boolean, value : true },
			showFiles :			{ type : Boolean, value : true },
			resize :			{ type : Boolean, value : true },

			backgroundItems : 	{ type : Object },
			firstUpload : 		{ type : Boolean, value : false },
			uploadedList : 		{ type : Object, value : function() { return {} } },
			wrapperPromptResult:{ type : String, notify : true, value : '[content]' },
			wrapperPromptCaption:{ type : String, notify : true, value : '<figure>[content]<figcaption>[caption]</figcaption></figure>' },
			wrapperPromptNoCaption:{ type : String, notify : true, value : '[content]' },
			dir : 				{ type : String, notify : true },
			rootDir : 			{ type : String, notify : true }, //, observer : "ls" },
			checkAvailability : { type : Boolean, value : false },
			currentTime : 		{ type : Number, value : 0 },
			limit : 			{ type : Number, value : 20 },
			isMore : 			{ type : Boolean, value : false },
			loadedFiles : 		{ type : Array, value : function() { return [] } },
			isLoading : 			{ type : Boolean, value : true },
			uploadedFiles : 	{ type : String, value : "" },
			loadedDirectories : { type : Array, value : function() { return [] } },
			isFirstTimeOpened : { type : Boolean, value : false },
			gallery : 			{ type : Boolean, value : false },
			renameFiles :		{ type : Boolean, value : false },
			tableselected :		{ type : String, notify : false },
			tempselected :		{ type : String, notify : false },
			inputValue :		{ type : String },
			fileName : 			{ type : String },
			filesList : 		{ type : Array , value : function () { return [] } },
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
			fileCaptions :		{ type : Array, value : function() { return {} } },

			isUploadingFiles : { type : Boolean, value : false },

			/** Enables prompt mode: sets maxItems to 1, hides selection, replaces Close button with Cancel and Select. */
			promptMode : { type : Boolean, value : false },

			/** Open by default - precursor to inline mode. */
			opened : { type : Boolean, value : false },
			
			textCloseSingleButton : { type : String, value : "OK" },
			textClosePromptButton : { type : String, value : "OK" },
			textCancelSingleButton : { type : String, value : "Cancel" },
			textUploadComplete : { type : String, value : "upload is complete" },
			textMustSelectFile : { type : String, value : "Please select a file to view its details" },

			textBrowse : { type : String, value : "Browse" },
			textOrDrop : { type : String, value : "Or drop files into this dialog" },
			textAddDir : { type : String, value : "Add dir" },
			textRename : { type : String, value : "Rename" },
			textDelete : { type : String, value : "Delete" },
			textShowDirectories : { type : String, value : "Show directories" },
			textShowFiles : { type : String, value : "Show files" },
			textFilter : { type : String, value : "Filter" },
			textSearchByDescription : { type : String, value : "Search by description" },
			textSize : { type : String, value : "Size" },
			textDate : { type : String, value : "Date" },
			
			textFileInfoHere : { type : String, value : 'File info will appear here' },
			textImageDimensions : { type : String, value : "Image dimensions" },
			textTitle : { type : String, value : "Title" },
			textCaption : { type : String, value : "Caption" },
			textDescription : { type : String, value : "Description" },
			textAlt : { type : String, value : "Alt" },
			
			// selection
			textSetCover : { type : String, value : "make cover" },
			textDescription : { type : String, value : "Description" },
			textMyFiles : { type : String, value : "My files" },
			textClearAll : { type : String, value : "Clear all" },
			
			textErrorUploading : { type : String, value : "Error [status] while uploading [files]" }, 
			textUploadedFiles : { type : String, value : "Uploaded files" }, 
			
			isiOS : { type : Boolean, value : /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream }, // thanks https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
			hideFilesNav : { type : Boolean, value : true }
		},

		xhrError : function() {
			const status = this.lastError && this.lastError.request.xhr.status;
			if(status == 401)
				this.fire('401 Unauthorized');
			
			if(this.lastError)
				console.log(this.lastError);
		},
		
		_filesChanged : function() { 
			this.cancelDebouncer('filesChanged');
			this.debounce('filesChanged', function() {
				this.setCurrentSelection(this.getCurrentSelection());
			}, 100);
		},
		
		_gentlySetFiles : function(files) {
			var i;
			
			if(this.files instanceof Array)
				for(i = 0; i < files.length && i < this.files.length && resolveUrl(files[i].url) == this.files[i].url; i++)
					files[i] = this.files[i]; // less shock for ui

			this.set('files', files);
		},
		
		observers: [
			'_urlsChanged(host, lsUrl, postUrl, renameUrl, findfileUrl, makedirUrl, deletefileUrl, getdescriptionUrl, updatefileUrl, searchbydescUrl)',
			'_dirsChanged(dir)', '_dirsChanged(rootDir)',"xhrError(lastError)","_filesChanged(files)"
		],

		behaviors: [
			Polymer.IronFormElementBehavior,
			typeof ir != 'undefined' && ir.ReflectToNativeBehavior
		],
		path : path,
		
		_rootdirchanged : function(n, o) {
			console.log(n, o)
		}
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
			url : { type : String },
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

			this._setIsSelected(true);
		},
		/** Unselect this ir-filebrowser-item */
		unselect : function() {
			this.$.container.classList.remove('selected');

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

	
		
	function formatTemplateVar(str, varName, varVal) {
		return str.replace("[" + varName + "]", varVal);
	}
	
	// replaces [varName]-s in a path template, currently [year] and [month]
	function formatTemplateVars(str) {
		var d = new Date(), 
			vals = {};
		
		// prepare available substitutions
		vals.year = d.getFullYear();
		vals.month = d.getMonth() + 1;
		vals.month = vals.month < 10 ? "0" + vals.month : vals.month;
		
		Object.keys(vals).forEach(function(k) { str = formatTemplateVar(str, k, vals[k]) }); 
		return str;
	}

	// a generator-like pager
	function filePager(itemsPerPage, processList) {
		return function(dataArr) {
			var page, lastValue, next, done;
			
			processList = processList || function(x) { return x }
			page = 0;
			lastValue = {};

			next = function(minItems)
			{
				page = minItems ? Math.min(Math.floor(minItems/itemsPerPage)) + 1 : page + 1;
				return lastValue = lastValue.done ? lastValue : { 
					next : next,
					value : dataArr.slice(0, itemsPerPage * page).map(processList),
					done : lastValue.done || (page * itemsPerPage >= dataArr.length)
				}
			}
			return {
				next : next,
				done : false
			}
		}
	}
	
})();
