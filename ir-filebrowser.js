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
			var protocol,
				lead = '', 
				trail = '';
			
			protocol = arguments[0].match(/^[^:]+:\/\//);
			
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

			var join, split = [].map.call(arguments, function(p) {
					return p.split('/');
				});
				
			join = [].concat.apply([], split).filter(function(p) { return p; }).join('/');

			
			return protocol + lead + join + trail;
		}
	};
	

	Polymer({
		is : 'ir-filebrowser',
		
		/**
		  * Loads list of files at location
		  *
		  * @method ls
		*/
		ls : function(relPath)
		{	
			if(typeof relPath !== 'string')
				relPath  = "";
			
			var split = this.relPath.split('/');
				
			if(split.length && !split[split.length-1])
				split.pop();

			if(relPath == '..')
				split.pop();
			else
			if(relPath)
				split.push(relPath);
			
			this.relPath = split.join('/');
			if(this.relPath)
				this.relPath += '/';
			
			var reqUrl = this._lsUrl.replace(/\[path\]/, this.relPath);
			
			if(this._lsUrl == reqUrl)
				reqUrl += this.relPath;
			
			this.$.loader.url = reqUrl;
			this.$.loader.generateRequest();
			
			this.postFields = { path : this.relPath };
		},
		
		/**
		  * displaysLoadedFiles
		  *
		  * @method displayLoadedFiles
		*/
		displayLoadedFiles : function () {
			var name, ext, t, fstat, sorted,
				directories = [], files = [], that = this;

			this.directories = [];
			this.files = [];

			var rootUrl = this.get(this.lsRootUrlPath, this.loadedData);
			var statsData = this.get(this.lsStatsPath, this.loadedData);

			sorted = statsData.sort(function(x,y) { return new Date(x.mtime) > new Date(y.mtime) });

			for(var i=0; i < sorted.length; i++)
			{
				fstat = sorted[i];
								
				fstat.rootUrl = rootUrl;
				// fstat.lsRootUrlPath = this.lsRootUrlPath;
				fstat.url = path.join(rootUrl, encodeURIComponent(fstat.name));
				fstat.relPath = this.relPath;
				this.getContentChildren()
					.filter(function(el) { return el.is == 'ir-filebrowser-item' && (el.item.url == fstat.url) })
					.forEach(function(el) { fstat.isSelected = true });
				Polymer.dom.flush();
				
				if(fstat.isDirectory)
					directories.push(fstat);
				else
					files.push(fstat);								
			}
			if(this.relPath)
				directories.unshift({ name : '..', ext : '..', isDirectory : true});
			
			this.directories = directories;
			this.files = files;
			
			console.log(this.files)
			//this.files = res;
		},
		
		clickDirectory : function(e) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
		},
				
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
		
		removeSelection : function(fstat) {
			var that = this;
			if(typeof fstat == 'string')
				fstat = { url : fstat };
			
			//this.selectedItems
			this._getSelectionElements()
				.forEach(function(el, i) {
						if(el.item.url != fstat.url)
							return;
						
						Polymer.dom(that).removeChild(el);
					});
						
			this._updateValue();
		},

		_getSelectionElements : function() {
			return this.getContentChildren()
					.filter(function(el) { return el.is == 'ir-filebrowser-item'});
		},
		
		/** Remove all items from selection */
		clearSelection : function() {
			var that = this;
			this._getSelectionElements()
				.forEach(function(el) { that.removeSelection(el.item); });
		},
		
		clickFile : function (e) {
			var that = this, newNode;

			if(!e.detail.isSelected)
			{
				e.detail.select();
				this.addSelection(e.detail.item);
			}
			else
			{
				e.detail.unselect();
				this.removeSelection(e.detail.item);
			}
			if(this.autoPreview)
				this.toggleView();
			
			// update content children, match by url
			Polymer.dom.flush();
		},
		
		/** Updates .value for ir-reflect-to-native-behavior */
		_updateValue : function() {
			var that = this;
			this.async(function() {
				that.value = this._getSelectionElements().map(function(s) { return s.item.url }).join(',');
				console.log('value updated to:', that.value);
			});
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
			this.$.dialog.open();
			this.ls(relPath);
			Polymer.dom.flush();			
		},
		
		hideDialog : function (e) {
			e.stopPropagation();
			this.$.dialog.close();
		},

		ready: function() {
			var that = this;
			
			this._urlsChanged();
			this.setupBrowser();
			
			this.async(function() { // wait for ir-filebrowser-items to initialize
				// collect values, remove and add again
				var preselection = [];
				that.getContentChildren()
					.filter(function(el) { return el.is == 'ir-filebrowser-item' })
					.forEach(function(el) { 
						//el.addEventListener('item-click', function () { that.showDialog() } ); 
						preselection.push(el.item);
						that.removeSelection(el);
					});
					
				that.async(function() {
					preselection.forEach(function(item) {
						that.addSelection(item);
					});
				});
			});
		},
		
		_urlsChanged : function() {
			this._lsUrl = path.join(this.host, this.lsUrl);
			this._postUrl = path.join(this.host, this.postUrl);
		},

		properties : {
			host : 				{ type : String, value : "", notify : true },
			lsUrl :				{ type : String, value : "", notify : true },
			lsRootUrlPath :		{ type : String, value : "/" },
			lsStatsPath :		{ type : String, value : "" },
			postUrl :			{ type : String, value : "", notify : true },
			
			postFields :		{ type : Object, value : { path : "" } },

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

			showDirectories :	{ type : Boolean, value : "true" },
			showFiles :			{ type : Boolean, value : "true" }
		},
		
		observers: [
			'_urlsChanged(host, lsUrl, postUrl)'
		],
		behaviors: [
			ir.ReflectToNativeBehavior
		]
		
	});

	var count = 0;
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
			{
				item.url = this.url;
				if(!item.name)
					item.name = item.url.match(/([^/]+)$/)[1];
			}
			if(!item.url) 
				item.url = item.rootUrl + encodeURIComponent(item.name);

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
			count++;
			this.count = count;
			console.log('ir-fb-item ready, url: ', this.url);
			if(this.url)
			{
				var item = {
					url : this.url
					//ext : this.url.match("([^.]+)$")[1]
				}
				//item.isImage = ['jpg','jpeg','gif','png'].indexOf(item.ext) > -1;
				
				this.item = item;
			}
		}
	});	

	function encodeQuery(q)
	{
		if(!q) 
			return ""
		return q.split("&").map(function(pair) { var res = pair.split("="); return [res[0], encodeURIComponent(res[1])].join("=") }).join('&');
	}
})();


