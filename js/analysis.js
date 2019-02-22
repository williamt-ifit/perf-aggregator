var reportAnalysisFailed = false;
var reportErrors = [];

var kbStoragePattern = /(\d+(\.\d+)?)kb?/i;
var mbStoragePattern = /(\d+(\.\d+)?)mb?/i;
var gbStoragePattern = /(\d+(\.\d+)?)gb?/i;
var tbStoragePattern = /(\d+(\.\d+)?)tb?/i;

function verifyDataCount (csv) {
	if (csv.errors.length > 0) {
		reportAnalysisFailed = true; 
		reportErrors.push (csv.errors);
		return false;
	}

	if (csv.data.length < 2) {
		reportAnalysisFailed = true; 
		reportErrors.push ("One or more csv files had fewer than two rows.");
		return false;
	}

	return true;
}

function initialVerification (baseBranchData, featureBranchData) {
	if (baseBranchData.length < 1) {
		reportAnalysisFailed = true; 
		reportErrors.push ("No base branch csv files provided.");
		return false;
	}

	if (featureBranchData.length < 1) {
		reportAnalysisFailed = true; 
		reportErrors.push ("No feature branch csv files provided.");
		return false;
	}

	var headers = baseBranchData[0].data[0];

	for(var i=0; i<baseBranchData.length; i++) {
		if (!verifyDataCount (baseBranchData[i])) {
			return false;
		}
		if (areDeeplyEqual(baseBranchData[i].data[0], headers) !== true) {
			reportAnalysisFailed = true; 
			reportErrors.push ("Csv files have mismatching headers:");
			reportErrors.push (baseBranchData[i].data[0].join(','));
			reportErrors.push (headers.join(','));
			return false;
		}
	}
	for(var i=0; i<featureBranchData.length; i++) {
		if (!verifyDataCount (featureBranchData[i])) {
			return false;
		}
		if (areDeeplyEqual(featureBranchData[i].data[0], headers) !== true) {
			reportAnalysisFailed = true; 
			reportErrors.push ("Csv files have mismatching headers:");
			reportErrors.push (featureBranchData[i].data[0].join(','));
			reportErrors.push (headers.join(','));
			return false;
		}
	}

	return true;
}

function sanitizedStorageValue (val) {
	var match = null;
	var multiplier = 1.0;
	if (mbStoragePattern.test(val)) {
		multiplier = 1000;
		match = mbStoragePattern.exec(val);
	} else if (gbStoragePattern.test(val)) {
		multiplier = 1000*1000;
		match = gbStoragePattern.exec(val);
	} else if (tbStoragePattern.test(val)) {
		multiplier = 1000*1000*1000;
		match = tbStoragePattern.exec(val);
	}

	if (match) {
		var numValString = match[1];
		return parseFloat(numValString) * multiplier;
	}

	return parseFloat(val);
}

function needsStorageValueSanitization (val) {
	return kbStoragePattern.test(val)
		|| mbStoragePattern.test(val)
		|| gbStoragePattern.test(val)
		|| tbStoragePattern.test(val);
}

function sanitizeStorageFieldForDataSet (csvData) {
	for(var i=1; i<csvData.length; i++) {
		var csvLine = csvData[i];
		for(var j=0; j<csvLine.length; j++) {
			if (needsStorageValueSanitization (csvLine[j])) {
				csvLine[j] = sanitizedStorageValue (csvLine[j]);
			}
		}
	}
}

function sanitizeStorageFieldForDataSets (dataSets) {
	for(var i=0; i<dataSets.length; i++) {
		sanitizeStorageFieldForDataSet (dataSets[i].data);
	}
}

function getStageKeyValues (csvData) {
	var stageIndex = csvData[0].indexOf("Stage");
	var result = {};
	for(var i=1; i<csvData.length; i++) {
		var csvLine = csvData[i];
		var stageName = csvLine[stageIndex];

		if (!stageName) {
			continue;
		}

		if (!(stageName in result)) {
			result[stageName] = [];
		}
		result[stageName].push (csvLine);
	}
	return result;
}



function genAggregates (values) {
	var min = getMin (values);
	var max = getMax (values);
	var mean = getMeanAvg (values);
	var maxMinDelta = max - min;
	var stdDev = getStandardDeviation (values);

	return {
		first: values[0],
		last: values[values.length-1],
		min: min,
		max: max,
		mean: mean,
		maxMinDelta: maxMinDelta,
		stdDeviation: stdDev
	};
}

function getStageAggregates (csvData) {
	var cpuPercentKey = "Percent";
	var cpuPercentIndex = csvData[0].indexOf (cpuPercentKey);

	var memoryKey = "Memory";
	var memoryIndex = csvData[0].indexOf (memoryKey);

	var storageKey = "FreeStorage";
	var storageIndex = csvData[0].indexOf (storageKey);

	// Getting a key/value object, keyed by the stage names
	var stageKeyValues = getStageKeyValues (csvData);
	var stages = Object.keys(stageKeyValues);
	var aggregates = {};

	for(var i=0; i<stages.length; i++) {
		var stage = stages[i];
		var stageValues = stageKeyValues[stage];

		if (stageValues.length < 1) {
			continue;
		}

		var cpuValues = [];
		var memValues = [];
		var storageValues = [];
		for(var j=0; j<stageValues.length; j++) {
			cpuValues.push(stageValues[j][cpuPercentIndex]);
			memValues.push(stageValues[j][memoryIndex]);
			storageValues.push(stageValues[j][storageIndex]);
		}

		var aggregate = {
			stageName:stage,
			sampleCount: stageValues.length,
			cpu: genAggregates (cpuValues),
			memory: genAggregates (memValues),
			storage: genAggregates (storageValues)
		};

		aggregates[stage] = aggregate;
	}

	return aggregates;
}

function getAllStageAggregates (dataSets) {
	var storageKey = "FreeStorage";
	var storageIndex = dataSets[0].data[0].indexOf (storageKey);

	var result = [];
	for(var i=0; i<dataSets.length; i++) {
		var dataSet = dataSets[i];
		var stageAggregates = getStageAggregates (dataSet.data);
		var beginningStorage = dataSet.data[1][storageIndex];
		var endingStorage = dataSet.data[dataSet.data.length-1][storageIndex];

		result.push({
			file: dataSet.meta.filename,
			aggregates: stageAggregates,
			beginningStorage: beginningStorage,
			endingStorage: endingStorage,
			storageDelta: (endingStorage - beginningStorage),
			frames: dataSet.data.length-1
		});
	}
	return result;
}

function singleSuperAggregate (aggregates) {
	var maxes = [];
	var maxMinDeltas = [];
	var means = [];
	var mins = [];
	var stdDeviations = [];
	var firsts = [];
	var lasts = [];

	for(var i=0; i<aggregates.length; i++) {
		maxes.push (aggregates[i].max);
		maxMinDeltas.push (aggregates[i].maxMinDelta);
		means.push (aggregates[i].mean);
		mins.push (aggregates[i].min);
		stdDeviations.push (aggregates[i].stdDeviation);
		firsts.push(aggregates[i].first);
		lasts.push(aggregates[i].last);
	}

	return {
		maximumValues: {
			max: getMax (maxes),
			maxMinDelta: getMax (maxMinDeltas),
			mean: getMax (means),
			min: getMax (mins),
			stdDeviation: getMax (stdDeviations),
			first: getMax (firsts),
			last: getMax (lasts)
		},
		minimumValues: {
			max: getMin (maxes),
			maxMinDelta: getMin (maxMinDeltas),
			mean: getMin (means),
			min: getMin (mins),
			stdDeviation: getMin (stdDeviations),
			first: getMin (firsts),
			last: getMin (lasts)
		},
		meanValues: {
			max: getMeanAvg (maxes),
			maxMinDelta: getMeanAvg (maxMinDeltas),
			mean: getMeanAvg (means),
			min: getMeanAvg (mins),
			stdDeviation: getMeanAvg (stdDeviations),
			first: getMeanAvg (firsts),
			last: getMeanAvg (lasts)
		}
	};
}

function combineAggregates (stageName, stageAggregates) {
	var cpuAggregates = [];
	var memoryAggregates = [];
	var storageAggregates = [];

	for(var i=0; i<stageAggregates.length; i++) {
		cpuAggregates.push (stageAggregates[i].cpu);
		memoryAggregates.push (stageAggregates[i].memory);
		storageAggregates.push (stageAggregates[i].storage);
	}

	var combinedCpuAggregate = singleSuperAggregate (cpuAggregates);
	var combinedMemoryAggregate = singleSuperAggregate (memoryAggregates);
	var combinedStorageAggregate = singleSuperAggregate (storageAggregates);

	return {
		stageName: stageName,
		cpu: combinedCpuAggregate,
		memory: combinedMemoryAggregate,
		storage: combinedStorageAggregate
	};
}

function generateSuperAggregate (stageAggregates) {
	// Getting an intersection of the stage keys across all aggregates
	var stageIntersection = Object.keys (stageAggregates[0].aggregates)
	for(var i=1; i<stageAggregates.length; i++) {
		var aggregateKeys = Object.keys (stageAggregates[i].aggregates);
		stageIntersection = intersect (stageIntersection, aggregateKeys);
	}

	var result = {};
	for(var i=0; i<stageIntersection.length; i++) {
		var stage = stageIntersection[i];
		var aggregatesForStage = [];
		for(var j=0; j<stageAggregates.length; j++) {
			aggregatesForStage.push(stageAggregates[j].aggregates[stage]);
		}
		var singleCombinedAggregate = combineAggregates(stage, aggregatesForStage);
		result[stage] = singleCombinedAggregate;
	}

	return result;
}

function generateBenchmarks (superAggregate) {
	var stateSuperAggregates = Object.values(superAggregate);
	var meanCpuAggregates = [];
	var meanMemoryAggregates = [];

	for(var i=0; i<stateSuperAggregates.length; i++) {
		var stateSuperAggregate = stateSuperAggregates[i];
		meanCpuAggregates.push (stateSuperAggregate.cpu.meanValues.mean);
		meanMemoryAggregates.push (stateSuperAggregate.memory.meanValues.mean);
	}

	return {
		cpu: {
			mean: getMeanAvg (meanCpuAggregates),
			stdDeviation: getStandardDeviation (meanCpuAggregates)
		},
		memory: {
			mean: getMeanAvg (meanMemoryAggregates),
			stdDeviation: getStandardDeviation (meanMemoryAggregates)
		}
	};
}

function generateStorageDeltaInfo (stageAggregates) {
	var deltas = [];
	for(var i=0; i<stageAggregates.length; i++) {
		deltas.push (stageAggregates[i].storageDelta);
	}

	return {
		min: getMin (deltas),
		max: getMax (deltas),
		mean: getMeanAvg (deltas),
		stdDeviation: getStandardDeviation (deltas)
	};
}

function createDataSetAggregates (dataSets) {
	// Getting an array of each run's stage aggregates
	var stageAggregates = getAllStageAggregates (dataSets);

	// Generating super-aggregate for each individual aggregate
	var superAggregate = generateSuperAggregate (stageAggregates);

	// Generating a benchmark across the entire app
	var benchmarks = generateBenchmarks (superAggregate);

	var storageDelta = generateStorageDeltaInfo (stageAggregates);

	return {
		aggregateBreakdown: stageAggregates,
		superAggregate: superAggregate,
		benchmarks: benchmarks,
		storageDelta: storageDelta
	};
}

function removeEmptyTailRows (set) {
	while(true) {
		var lastRow = set.data[set.data.length-1];
		if (!lastRow || lastRow.length < 1 || (lastRow.length == 1 && !lastRow[0])) {
			set.data.pop();
		} else {
			break;
		}
	}
}

function removeEmptyTailRowsForAll (dataSet) {
	dataSet.forEach (function (set) {
		removeEmptyTailRows (set);
	});
}

function analyzeDataSets (baseBranchData, featureBranchData, reportName) {
	// Removing empty tailing rows
	removeEmptyTailRowsForAll (baseBranchData);
	removeEmptyTailRowsForAll (featureBranchData);

	// Initial verification of headers, making sure everything matches, etc.
	if (!initialVerification (baseBranchData, featureBranchData)) {
		return false;
	}

	// Converting "Free storage" column values from something like "1.5G" to an integer
	sanitizeStorageFieldForDataSets (baseBranchData);
	sanitizeStorageFieldForDataSets (featureBranchData);

	// Aggregating each of the data sets into a single 
	baseBranchDataAggregates = createDataSetAggregates (baseBranchData);
	featureBranchDataAggregates = createDataSetAggregates (featureBranchData);

	return {
		reportName: reportName,
		timestamp: Math.round(new Date().getTime()/1000.0),
		base: baseBranchDataAggregates,
		feature: featureBranchDataAggregates,
		reportVer: ReportVer
	};
}
