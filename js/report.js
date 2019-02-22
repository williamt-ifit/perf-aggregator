const BaseColor = '#007bff';
const FeatureColor = '#28a745';

const urlParams = new URLSearchParams(window.location.search);
const idParam = urlParams.get('id');

var $importConfirmBtn = null;
var $importTextArea = null;
var $reportContainer;
var tempImportedReportJson = '';

function onLoad () {
	$reportContainer = jQuery('#report');
	jQuery('#footer-text').html(
		`iFit Performance Report Generator - ver. ${ReportVer}<br/>
		<a href="https://github.com/williamt-ifit/perf-aggregator">GitHub</div>`
	);

	$importTextArea = jQuery('#input-json-textarea');
	$importConfirmBtn = jQuery('#import-confirm-btn');

	$importTextArea.bind('input propertychange', function (e) {
		var val = $importTextArea.val();
		$importConfirmBtn.removeClass('btn-secondary');
		$importConfirmBtn.removeClass('btn-primary');
		$importConfirmBtn.removeAttr('disabled');

		if (val) {
			$importConfirmBtn.addClass('btn-primary');
		} else {
			$importConfirmBtn.addClass('btn-secondary');
			$importConfirmBtn.attr('disabled','disabled');
		}
	});
	$importConfirmBtn.click(importButtonClicked);

	configureCharts();
	refreshTooltips();
	
	if(idParam) {
		downloadReport(idParam);
	}
}

function configureCharts () {
	Chart.defaults.LineWithLine = Chart.defaults.line;
	Chart.controllers.LineWithLine = Chart.controllers.line.extend({
		draw: function(ease) {
			Chart.controllers.line.prototype.draw.call(this, ease);

			if (this.chart.tooltip._active && this.chart.tooltip._active.length) {
				var activePoint = this.chart.tooltip._active[0];
				var ctx = this.chart.ctx;
				var x = activePoint.tooltipPosition().x;
				var topY = this.chart.scales['y-axis-0'].top;
				var bottomY = this.chart.scales['y-axis-0'].bottom;

				// draw line
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(x, topY);
				ctx.lineTo(x, bottomY);
				ctx.lineWidth = 2;
				ctx.strokeStyle = '#07C';
				ctx.stroke();
				ctx.restore();
			}
		}
	});
	Chart.Tooltip.positioners.custom = function(elements, eventPosition) {
		/** @type {Chart.Tooltip} */
		var tooltip = this;
	
		/* ... */
	
		return {
			x: 10,
			y: elements[0]._yScale.bottom+70
		};
	}
}

function refreshTooltips() {
	jQuery('[data-toggle="tooltip"]').tooltip();
}

function createSpinnerElement (text) {
	return jQuery(
		`<div id="progress-container" class="container">
			<div class="text-center">
				<div class="spinner-border text-primary" role="status"></div>
				<p id="main-progress-text" class="progress-text lead">${text}</p>
			</div>
		</div>`
	);
}

function setDownloading(downloading) {
	$reportContainer.empty();
	if (downloading) {
		$reportContainer.append(createSpinnerElement ('Downloading report'));
	}
}

function handleReportDownloadSuccess (b64) {
	setDownloading(false);
	var json = atob(b64);
	importReport (json, idParam);
}

function handleReportDownloadError (error) {
	setDownloading(false);
	reportLoadError ();
}

function handleReportUploadError (error) {
	setDownloading(false);
	reportLoadError ();
}

function downloadReport (id) {
	setDownloading(true);
	Bucket.get(id, handleReportDownloadSuccess, handleReportDownloadError);
}

function setUploadingProgress(uploading) {
	$reportContainer.empty();
	if (uploading) {
		$reportContainer.append(createSpinnerElement ('Uploading report'));
	}
}

function handleUploadError(error) {
	setUploadingProgress(false);
	importReport (tempImportedReportJson, newGuid());
	tempImportedReportJson = '';
}

function handleUploadSuccess (id) {
	tempImportedReportJson = '';
	window.location.href = `report.html?id=${id}`;
}

function importButtonClicked () {
	var json = $importTextArea.val();
	tempImportedReportJson = json;
	$importTextArea.val('');
	var b64 = btoa(json);
	setUploadingProgress(true);
	Bucket.set(b64, handleUploadSuccess, handleUploadError);
}

function importReport(json, id) {
	if (!json) {
		reportLoadError();
		return;
	}

	var report = JSON.parse(json);
	if (!report) {
		reportLoadError();
		return;
	}

	loadReport(report, id);
}

function reportLoadError () {
	jQuery('#report').empty();
	jQuery('#report').html(
		`<div class="row top-row">
			<div class="col-md-12 text-center">
				<p class="lead">The report you have tried to access is either invalid, or contains malformed JSON.</p>
				<p class="lead">You can <a href="index.html">go back</a> and generate a report, or import a JSON report with the button above.</p>
			</div>
		</div>`
	);
}

function atAGlanceChartData(reportAggregates, metricType, title, color) {
	var dataPoints = [];
	for(var i=0; i<reportAggregates.length; i++) {
		var y = reportAggregates[i][metricType].meanValues.mean;
		dataPoints.push (y);
	}

	return {
		label: title,
		backgroundColor: color,
		borderColor: color,
		data: dataPoints,
		fill: false
	};
}

function buildAtAGlanceChart($chart, report, metricType) {
	var baseStateKeys = Object.keys(report.base.superAggregate);
	var featureStateKeys = Object.keys(report.feature.superAggregate);

	var stateIntersection = intersect(baseStateKeys, featureStateKeys);

	var baseIntersectedSuperAggregate = {};
	var featureIntersectedSuperAggregate = {};
	stateIntersection.forEach(function (state) {
		baseIntersectedSuperAggregate[state] = report.base.superAggregate[state];
		featureIntersectedSuperAggregate[state] = report.feature.superAggregate[state];
	});

	var baseDataSet = atAGlanceChartData (Object.values(baseIntersectedSuperAggregate), metricType, "Base", BaseColor);
	var featureDataSet = atAGlanceChartData (Object.values(featureIntersectedSuperAggregate), metricType, "Feature", FeatureColor);

	var config = {
		type: 'LineWithLine',
		data: {
			labels: stateIntersection,
			datasets: [baseDataSet, featureDataSet]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			title: {
				display: false
			},
			tooltips: {
				enabled:true,
				mode: 'index',
				position:'custom',
				intersect:false,
				callbacks: {
					label: function(tooltipItem, data) {
						var val = parseFloat(tooltipItem.yLabel);
						var rounded = val.toFixed(2);
						var branch = data.datasets[tooltipItem.datasetIndex].label;
						return `${branch} - ${rounded}`;
					}
				},
				caretSize:0
			},
			scales: {
				xAxes: [{
					display: false
				}],
				yAxes: [{
					display: true,
					scaleLabel: {
						display: false
					}
				}]
			},
			layout: {
				padding: {
					left: 0,
					right: 0,
					top: 0,
					bottom: 80
				}
			}
		}
	};

	new Chart($chart, config);
}

function atAGlance($reportElement, report) {
	var $atAGlance = jQuery(
		`<div class="section-row">
			<div class="at-a-glance row">
				<div class="col-md-12 section-header">
					<h2>At a glance</h2>
				</div>
			</div>
			<hr/>
			<div class="row">
				<div class="col-md-6 ">
					<h4>Average CPU Utilization (%)</h4>
					<div class="at-a-glance-container">
						<canvas class="chart chart-at-a-glance line-chart line-chart-compare" id="chart-at-a-glance-cpu"></canvas>
					</div>
				</div>
				<div class="col-md-6 ">
					<h4>Average Memory Used (MB)</h4>
					<div class="at-a-glance-container">
						<canvas class="chart chart-at-a-glance line-chart line-chart-compare" id="chart-at-a-glance-memory"></canvas>
					</div>
				</div>
			</div>
		</div>`
	);
	$reportElement.append($atAGlance);

	var $cpuChart = jQuery('#chart-at-a-glance-cpu');
	buildAtAGlanceChart ($cpuChart, report, "cpu");
	var $memChart = jQuery('#chart-at-a-glance-memory');
	buildAtAGlanceChart ($memChart, report, "memory");
}

function generateBenchmark (title, baseData, featureData, units) {
	var diff = featureData.mean - baseData.mean;
	var stdDeviation = getMeanAvg ([baseData.stdDeviation, featureData.stdDeviation]);

	var color = 'ideal';
	if (diff > 0) {
		color = 'warn';
	}
	if (diff > stdDeviation) {
		color = 'nonideal';
	}

	return {
		title: title,
		base: `${baseData.mean.toFixed (3)}${units}`,
		feature: `${featureData.mean.toFixed (3)}${units}`,
		difference: `${diff >= 0.0 ? '+' : ''}${diff.toFixed (3)}${units}`,
		stdDeviation: `${stdDeviation.toFixed (3)}${units}`,
		color: color
	};
}

function generateStorageBenchmark (title, report) {
	var diff = report.feature.storageDelta.mean - report.base.storageDelta.mean;
	var stdDeviation = getMeanAvg ([report.base.storageDelta.stdDeviation, report.feature.storageDelta.stdDeviation]);
	var units = ' kB';

	var color = 'ideal';
	if (diff > 0) {
		color = 'warn';
	}
	if (diff > stdDeviation) {
		color = 'nonideal';
	}

	return {
		title: title,
		base: `${report.base.storageDelta.mean.toFixed (3)}${units}`,
		feature: `${report.feature.storageDelta.mean.toFixed (3)}${units}`,
		difference: `${diff >= 0.0 ? '+' : ''}${diff.toFixed (3)}${units}`,
		stdDeviation: `${stdDeviation.toFixed (3)}${units}`,
		color: color
	};
}

function generateBenchmarks (report) {
	return [
		generateBenchmark ("CPU %", report.base.benchmarks.cpu, report.feature.benchmarks.cpu, '%'),
		generateBenchmark ("Memory", report.base.benchmarks.memory, report.feature.benchmarks.memory, ' MB'),
		generateStorageBenchmark ("Storage", report)
	];
}

function generateBenchmarkElement (benchmark, width) {
	return jQuery(
		`<div class="col-md-${width} ">
			<h4>${benchmark.title}</h4>
			<div class="benchmark-row benchmark-row-base row" style="border-color: ${BaseColor}">
				<div class="benchmark-row-label">Base</div>
				<div class="benchmark-row-value text-right">${benchmark.base}</div>
				<div class="c-b"></div>
			</div>
			<div class="benchmark-row benchmark-row-feature row" style="border-color: ${FeatureColor}">
				<div class="benchmark-row-label">Feature</div>
				<div class="benchmark-row-value text-right">${benchmark.feature}</div>
				<div class="c-b"></div>
			</div>
			<div class="benchmark-row benchmark-row-diff benchmark-row-diff-${benchmark.color} row">
				<div class="benchmark-row-label">Difference</div>
				<div class="benchmark-row-value text-right">${benchmark.difference}</div>
				<div class="c-b"></div>
			</div>
			<div class="small-tip-text">
				<strong>Std deviation: </strong>${benchmark.stdDeviation}
			</div>
		</div>`
	);
}

function benchmarks ($reportElement, report) {
	var $benchmarks = jQuery(
		`<div class="section-row">
			<div class="benchmarks row">
				<div class="col-md-12 section-header">
					<h2>Benchmarks</h2>
				</div>
			</div>
			<hr/>
			<div class="row" id="benchmark-row">
			</div>
		</div>`
	);
	$reportElement.append($benchmarks);

	var $benchmarkRow = jQuery('#benchmark-row');
	var benchmarks = generateBenchmarks(report);
	var width = 12/benchmarks.length;

	for(var i=0; i<benchmarks.length; i++) {
		var $benchmark = generateBenchmarkElement(benchmarks[i], width);
		$benchmarkRow.append($benchmark);
	}
}

function titleAndDate ($reportElement, name, timestamp) {
	var date = moment(timestamp * 1000);
	$reportElement.append(jQuery(
		`<div class="title-date row">
			<div class="col-md-6 report-title">
				<h4>${name}</h4>
			</div>
			<div class="col-md-6 report-date">
				<h4>${date.format('MMMM Do YYYY, h:mm:ss a')}</h4>
			</div>
		</div>`
	));
}

function loadReport(report, id) {
	var $reportElement = jQuery('#report').first();
	$reportElement.empty();
	setExportButton(report, id);

	checkVersion ($reportElement, report);
	if ('reportName' in report && 'timestamp' in report) {
		titleAndDate ($reportElement, report.reportName, report.timestamp);
	}
	atAGlance($reportElement, report);
	benchmarks($reportElement, report);

	refreshTooltips();
}

function checkVersion ($reportElement, report) {
	var outdated = false;
	if (!('reportVer' in report)) {
		outdated = true;
	}
	if (report.reportVer !== ReportVer) {
		outdated = true;
	}

	if (outdated) {
		$reportElement.append(jQuery(
			`<div class="alert alert-danger" role="alert">
				This report was generated by a different version of the tool.<br>
				Some features may behave unexpectedly.
			</div>`
		));
	}
}

function setExportButton (report, id) {
	jQuery('#export-btn').removeClass('btn-secondary');
	jQuery('#export-btn').addClass('btn-primary');
	jQuery('#export-btn').removeAttr('disabled');
	jQuery('#export-btn').click (function () {
		downloadObjectAsJson (report, `report-${id}`);
	});
}

jQuery(document).ready(onLoad);
