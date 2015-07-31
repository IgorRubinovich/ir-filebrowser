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
		  * Loads list of files at location
		  *
		  * @method ls
		*/
		ls : function(relPath)
		{	
			if(typeof relPath != 'string')
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
			
			console.log("will request " + reqUrl);
			
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
			console.log("displayLoadedFiles");
			var rootUrl = this.get(this.lsRootUrlPath, this.loadedData);
			var statsData = this.get(this.lsStatsPath, this.loadedData);

			sorted = statsData.sort(function(x,y) { return new Date(x.mtime) > new Date(y.mtime) });

			for(var i=0; i < sorted.length; i++)
			{
				fstat = sorted[i];
								
				if(fstat.isDirectory)
					directories.push(fstat);
				else
					files.push(fstat);
				
				name = fstat.name;
				t = name.split(".");
				fstat.ext = fstat.isDirectory ? "<dir>" : t[t.length-1].toLowerCase();
				fstat.isImage = ['jpeg','jpg','png','gif'].indexOf(fstat.ext) > -1;
				fstat.url = this.host + rootUrl + encodeURIComponent(name);
				
				this.selectedItems.forEach(function(el) { if(el.item.url == fstat.url) fstat.isSelected = true });
			}
			if(this.relPath)
				directories.unshift({ name : '..', ext : '..', isDirectory : true});
			
			this.directories = directories;
			this.files = files;
			//this.files = res;
			Polymer.dom.flush();
		},
		
		clickDirectory : function(e) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
		},
		
		clickFile : function (e) {
			var that = this;
			if(!e.detail.isSelected)
			{
				if(!this.multi && this.selectedItems.length)
				{
					this.selectedItems.forEach(function(f) { f.unselect() });
					while(this.selectedItems.length)
						this.pop('selectedItems');
				}
				e.detail.select();
				
				if(!e.detail.item.isDirectory)
					this.push('selectedItems', e.detail);

				if(!e.detail.item.isDirectory && this.autoPreview)
					this.toggleView();	
			}
			else
			{
				e.detail.unselect();
				this.selectedItems.forEach(function(el, i) {
					if(el.item.url == e.detail.item.url)
						that.splice('selectedItems', i);
				});
			}
			
			this.selected = this.selectedItems.map(function(i) { return i.item });
		},
		dblclickFile : function (e) {
			if(e.detail.item.isDirectory)
				this.ls(e.detail.item.name);
		},
		unselect : function (e) {
			//this.preview = true;			
		},
				
		getValue: function(obj, key) {
			return obj[key];
		},
		
		setupBrowser: function() {
			if(!this.setupDone)
			{
				this.$.fileUploader.setupDrop();
				this.$.fileUploader._fileClick = function () {}; //setupDrop(this.$.selectorContainer);
				this.setupDone = true;
			}
		},

		showDialog : function() {
			this.$.dialog.open();
			this.ls();
			Polymer.dom.flush();			
		},
		
		hideDialog : function (e) {
			e.stopPropagation();
			this.$.dialog.close();
		},

		ready: function() {
			this._urlsChanged();

			this.setupBrowser();
			
			if(this.cloneToNative && this.name)
			{
				form = this.parentElement;
				while(form && form.tagName.toLowerCase() != 'form') 
					form = form.parentElement;
					
				if(!form)
					return;
				
				this.nativeClone = document.createElement('input');
				this.nativeClone.setAttribute("type", "hidden");
				this.nativeClone.setAttribute("name", this.name);
				this.name = "";
				
				this.updateValue();
				
				form.insertBefore(this.nativeClone, this);
			}

		},
		
		_urlsChanged : function() {
			this._lsUrl = this.host + this.lsUrl;
			this._postUrl = this.host + this.postUrl;
			console.log('urls changed!');
		},

		observers : [
			'_urlsChanged(host, lsUrl, postUrl)'
		],
		
		properties : {
			host : 				{ type : String, value : "", notify : true },
			lsUrl :				{ type : String, value : "", notify : true },
			lsRootUrlPath :		{ type : String, value : "" },
			lsStatsPath :		{ type : String, value : "" },
			postUrl :			{ type : String, value : "", notify : true },
			
			postFields :		{ type : Object, value : { path : "" } },

			relPath : 			{ type : String, value : "/" },
			loadedData	:		{ type : Object },
			listProperty	:	{ type : String, notify : true },
			rootUrlProperty	:	{ type : String, notify : true },

			selected	:		{ type : Array, notify : true },
			selectedItems	:	{ type : Array, value : [], notify : true },
			multi :				{ type : Boolean, notify : true },
			
			autoPreview :		{ type : Boolean },
			
			cloneToNative :		{ type : Boolean,	value : true },
			name :				{ type : String, value : "" },

			showDirectories :	{ type : Boolean, value : "true" },
			showFiles :			{ type : Boolean, value : "true" }
		},
		
		observers: [
			//'onLoadedData(loadedData)'
		],
		
	});

	var count = 0;
	Polymer(
	{
		is : 'ir-filebrowser-item',
		click : function(ev) {
			this.fire("item-click", this);
		},
		dblclick : function(ev) {
			this.fire("item-dblclick", this);
			ev.stopPropagation();
		},
		select : function() {
			this.$.container.classList.add('selected');
			this.$.container.elevation = "0";
			this.isSelected = true;
		},
		unselect : function() {
			this.$.container.classList.remove('selected');
			this.$.container.elevation = "2";
			this.isSelected = false;
		},
		properties : {
			item : { type : Object, observer : "_itemChanged", notify : true },
			index : { type : Number },
			isSelected : { type : Boolean }
		},
		_itemChanged : function() {
			if(this.item.isSelected)
				this.isSelected;
			//this.set('item.isImage', this.item.isImage);
			
			if(this.item.isImage)
				this.async(function() { 
					//this.$$('#imgthumb').style.backgroundImage = 'url(' + this.item.src + ')';
					Polymer.dom.flush();
				});
			
		},
		ready : function() {
			count++;
			this.count = count;
		}
	});	
	
	function encodeQuery(q)
	{
		if(!q) 
			return ""
		return q.split("&").map(function(pair) { var res = pair.split("="); return [res[0], encodeURIComponent(res[1])].join("=") }).join('&');
	}
})();


