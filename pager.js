function filePager(itemsPerPage, processList) {
	return function(dataArr) {
		var page, lastValue, next, done;
		
		processList = processList || function(x) { return x }
		page = 0;
		lastValue = {};

		next = function()
		{
			return lastValue = { 
				next : next,
				value : lastValue.done ? lastValue : dataArr.slice(0, itemsPerPage * (++page)).map(processList),
				done : lastValue.done || (page * itemsPerPage >= dataArr.length)
			}
		}
		return {
			next : next,
			done : false
		}
	}
}

(function test_filePager() {
	var items = [], n = 0, pager;
	while(n < 30) items.push(2 * n++);
	
	pager = filePager(7, function(v, i) { return "(" + v + " " + i + ")" } )(items);

	while(!pager.done)
	{
		pager = pager.next();
		console.log(pager.value.join(" "))
	}
	for(n = 0; n < 10; n++)
		console.log(pager.value.join(" "))

})()