const ReportVer = 0.7;
const Bucket = new BucketClient ('WkhNM1lXTmlLaWdrV1VJNmRtRmlPRGwwWW1GNVlrSlpLbFJNV1dKMmJIb3NkMmwxWlhjc1ltaDFkbVYwV2toTk0xbFhUbWxMYVdkclYxVkpObVJ0Um1sUFJHd3dXVzFHTlZsclNscExiRkpOVjFkS01tSkliM05rTW13eFdsaGpjMWx0YURGa2JWWXdXa2hOTTFsWFRtbExhV2RyVjFWSk5tUnRSbWxQUkd3d1dXMUdOVmxyU2xwTGJGSk5WMWRLTW1KSWIzTmtNbXd4V2xoamMxbHRhREZrYlZZd1YydG9UazB4YkZoVWJXeE1ZVmRrY2xZeFZrcE9iVkowVW0xc1VGSkhkM2RYVnpGSFRsWnNjbE5zY0V4aVJrcE9WakZrUzAxdFNrbGlNMDVyVFcxM2VGZHNhR3BqTVd4MFlVUkdhMkpXV1hjPQ==');

function getStandardDeviation (values) {
	if (values.length < 2) return 0;

	var mean = getMeanAvg (values);
	var squareSum = 0.0;

	for(var i=0; i<values.length; i++) {
		squareSum += Math.pow(values[i] - mean, 2);
	}

	return Math.sqrt(squareSum / (values.length - 1));
}

function getMeanAvg (values) {
	if (values.length < 1) return 0;
	if (values.length == 1) return values[0];

	var sum = 0.0;
	for(var i=0; i<values.length; i++) {
		sum += values[i];
	}

	return 1.0 * sum / values.length;
}

function getMax (values) {
	if (values.length < 1) return 0;
	if (values.length == 1) return values[0];

	var max = values[0];
	for(var i=0; i<values.length; i++) {
		if (values[i] > max) {
			max = values[i];
		}
	}

	return max;
}

function getMin (values) {
	if (values.length < 1) return 0;
	if (values.length == 1) return values[0];

	var min = values[0];
	for(var i=0; i<values.length; i++) {
		if (values[i] < min) {
			min = values[i];
		}
	}

	return min;
}



function areDeeplyEqual (value, other) {
	// Get the value type
	var type = Object.prototype.toString.call(value);

	// If the two objects are not the same type, return false
	if (type !== Object.prototype.toString.call(other)) return false;

	// If items are not an object or array, return false
	if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

	// Compare the length of the length of the two items
	var valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
	var otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
	if (valueLen !== otherLen) return false;

	// Compare two items
	var compare = function (item1, item2) {

		// Get the object type
		var itemType = Object.prototype.toString.call(item1);

		// If an object or array, compare recursively
		if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
			if (!isEqual(item1, item2)) return false;
		}

		// Otherwise, do a simple comparison
		else {

			// If the two items are not the same type, return false
			if (itemType !== Object.prototype.toString.call(item2)) return false;

			// Else if it's a function, convert to a string and compare
			// Otherwise, just compare
			if (itemType === '[object Function]') {
				if (item1.toString() !== item2.toString()) return false;
			} else {
				if (item1 !== item2) return false;
			}

		}
	};

	// Compare properties
	if (type === '[object Array]') {
		for (var i = 0; i < valueLen; i++) {
			if (compare(value[i], other[i]) === false) return false;
		}
	} else {
		for (var key in value) {
			if (value.hasOwnProperty(key)) {
				if (compare(value[key], other[key]) === false) return false;
			}
		}
	}

	// If nothing failed, return true
	return true;
}

function S4() {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function newGuid() {
	return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0, 3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
}

function intersect(a, b) {
	var setA = new Set(a);
	var setB = new Set(b);
	var intersection = new Set([...setA].filter(x => setB.has(x)));
	return Array.from(intersection);
}

function downloadObjectAsJson(exportObj, exportName){
	var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, undefined, '\t'));
	var downloadAnchorNode = document.createElement('a');
	downloadAnchorNode.setAttribute("href",     dataStr);
	downloadAnchorNode.setAttribute("download", exportName + ".json");
	document.body.appendChild(downloadAnchorNode); // required for firefox
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}
