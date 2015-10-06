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

			if(!abs) {
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
					throw new Error("Can not use .. in path");

				};

				this.relPath = relPath;
			}



			if(this.relPath)
				this.relPath += '/';
			
			var reqUrl = this._lsUrl.replace(/\[path\]/, this.relPath);
			
			if(this._lsUrl == reqUrl)
				reqUrl += this.relPath; //this.host + reqUrl; error!
			
			this.$.loader.url = reqUrl;
			this.$.loader.generateRequest();
			
			this.postFields = { path : this.relPath };
		},
		
/**
  * Displays files loaded as a result of calling ls
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

			if(!this.loadedData)
				return;
				
			this.files = [];
			this.directories = [];

			rootUrl = this.get(this.lsRootUrlPath, this.loadedData);
			statsData = this.get(this.lsStatsPath, this.loadedData);

			sorted = statsData.sort(function(x,y) { return new Date(x.mtime) > new Date(y.mtime) });

			for(var i=0; i < sorted.length; i++)
			{
				fstat = sorted[i];
								
				fstat.rootUrl = rootUrl;
				// fstat.lsRootUrlPath = this.lsRootUrlPath;
				fstat.url = path.join(rootUrl, encodeURIComponent(fstat.name));
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
			}
			if(this.relPath) // create an '..' directory entry
				directories.unshift({ 
					name : '..', 
					ext : '..', 
					isDirectory : 
					true, 
					relPath : this.relPath,
					rootUrl : fstat.rootUrl
				});
			
			this.set("directories", directories);
			this.set("files", files);
			
			//this.addEventListener('item-attached', this.refitDialog);
			
			Polymer.dom.flush();

			//this.files = res;
		},
		
		refitDialog : function() {
			console.log('refitting');
			//this.$.dialog.refit();
			this.async(function() {
				this.$.dialog.refit();
				this.$.dialog.constrain();
				this.$.dialog.center();

				//this.$.scrollableDialog.center();
				Polymer.dom.flush();
			});
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
			this.ls(relPath);
		},

		findFile : function() {
			if (this.inputValue !== null){
				this.$.findfileloader.url = this._findfileUrl.replace(/\[path\]/, this.inputValue);  //"/medialib/json/find/" + this.inputValue;
				this.$.findfileloader.generateRequest();
			};
		},

		showfindedFiles : function() {
			this.async(function(){
				var findedArr = this.findedFile,
					findedList = [];

				this.findedList = [];

				for (var i = 0; i < findedArr.length; i++)
					findedList.push(findedArr[i]);

				this.set("findedList", findedList);
			});
		},

		renameFile : function() {
			if(this.renameFiles == false)
				this.renameFiles = true;
			else
				this.renameFiles = false;
		},

		jumptofilePath : function(e, relPath) {
			this.tableselected = "0";

			this.refitDialog();

			this.abs = true;

			if(this.relPath == "") {
				this.ls(e.model.item.shortpath);
			}
			else
			{
				this.relPath = "";
				this.ls(e.model.item.shortpath, this.abs);
			};
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
				return false;
			}
			
			
			if(typeof fstat == 'string')
				fstat == { url : fstat };
			
			// prevent duplicates
			if(selectedElements.filter(function(el) { return el.item.url == fstat.url }).length)
			{	
				this.fire('item-duplicate', fstat);
				return;
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
			console.log('prompt selected!')
			this.hideDialog();
			this.promptCallback(this.value);
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
			if(typeof url == 'string')
				url = { url : url };

			// unselect in selection
			this._getSelectionElements()
				.forEach(function(el, i) {
					if(el.item.url == url.url)				
						Polymer.dom(that).removeChild(el);
				});
			
			// unselect in file browser dialog
			Polymer.dom(this.$.uploaderContainer).childNodes
				.forEach(function(el) { 
					if (el.is == 'ir-filebrowser-item' && el.item.url == url.url) 
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
				.forEach(function(el) { that.removeSelection(el.item); });
				
			this.value = '';
		},
		
		/** Toggles clicked file */
		clickFile : function (e) {
			var that = this;
			if (this.renameFiles == true)
			{
				var fname = e.detail.item.name,
					rename = prompt("New file name", fname);
				if ((fname && rename) !== null) {
					this.$.renamefileloader.url = this._renameUrl.replace(/\[path\]/, fname);  //"/medialib/json/rename/" + fname;
					this.$.renamefileloader.contentType = "application/x-www-form-urlencoded";
					this.$.renamefileloader.body = {name: rename};
					this.$.renamefileloader.generateRequest();
				};
			}
			else {
				if (!e.detail.isSelected) {
					this.addSelection(e.detail.item);
					e.detail.select();
				}
				else {
					this.removeSelection(e.detail.item);
					e.detail.unselect();
				}
				if (this.autoPreview && !this.promptMode)
					this.hideDialog();

				this._updateValue();
				Polymer.dom.flush();
			};
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
			this.ls(e.detail.item.name);
		},
		unselect : function (e) {
			//this.preview = true;			
		},

		setupBrowser: function() {
			if(!this.setupDone)
			{
				this.$.fileUploader.setupDrop();
				this.$.fileUploader._fileClick = function () {}; //setupDrop(this.$.selectorContainer);
				this.setupDone = true;
			}
		},

		showDialog : function(relPath) {
			// Polymer.dom.flush();
			this.tableselected = "0";
			this.$.dialog.open();
			this.ls(relPath);
			this.async(function() {
				this.refitDialog()
			});
		},
		
		hideDialog : function (e) {
			this.$.dialog.close();
		},

		ready: function() {
			var that = this;
			
			if(this.promptMode)
			{
				this.$.dialog.modal = true;			
				this.maxItems = 1;
				this.autoPreview = false; // until there's a better way
			}
			
			this._urlsChanged();
			this.setupBrowser();
			
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
			this._lsUrl = path.join(this.host, this.lsUrl);
			this._makedirUrl = path.join(this.host, this.makedirUrl);
			this._findfileUrl = path.join(this.host, this.findfileUrl);
			this._renameUrl = path.join(this.host, this.renameUrl);
			this._postUrl = path.join(this.host, this.postUrl);
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

			renameFiles :		{ type : Boolean, value : false},
			tableselected :		{ type : String, notify : false },
			tempselected :		{ type : String, notify : false },
			inputValue :		{ type : String },

			/** Enables prompt mode: sets maxItems to 1, hides selection, replaces Close button with Cancel and Select. */
			promptMode :			{ type : Boolean, value : false }
		},
		
		observers: [
			'_urlsChanged(host, lsUrl, postUrl, renameUrl, findfileUrl, makedirUrl)'
		],
		behaviors: [
			ir.ReflectToNativeBehavior
		]
		
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
			this._setIsSelected(true);
		},
		/** Unselect this ir-filebrowser-item */
		unselect : function() {
			this.$.container.classList.remove('selected');
			this.$.container.elevation = "2";
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
			
			if(!item.url) // should have been provided or constructed by this point
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


