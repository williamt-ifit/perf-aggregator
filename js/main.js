var baseFiles = {};
var featureFiles = {};
var $mainProgressText = null;
var temporaryReport = {};

function bs_input_file() {
	$('.input-ghost').remove();
	$(".input-file").before(
		function() {
			var $ghost = $("<input type='file' class='input-ghost' accept='text/csv'>");
			var $chooseBtn = $(this).find("button.btn-choose");
			var $input = $(this).find('input');

			$input.unbind('mousedown');
			$chooseBtn.unbind('click');

			$ghost.attr("name", $(this).attr("name"));
			$ghost.change(function() {
				fileAdded($ghost[0].files[0], $ghost.parent ().find('ul').first());
				$ghost.remove();
				bs_input_file();
			});
			$chooseBtn.click(function() {
				$ghost.click();
			});
			$input.css("cursor", "pointer");
			$input.mousedown(function() {
				$(this).parents('.input-file').prev().click();
				return false;
			});
			return $ghost;
		}
	);
}

function refreshValidation () {
	var canRun = Object.keys(baseFiles).length > 0 && Object.keys(featureFiles).length > 0;
	var $runButton = jQuery('#run-button');

	if (canRun) {
		$runButton.removeClass('btn-secondary');
		$runButton.removeAttr('disabled');
		$runButton.addClass('btn-primary');
	} else {
		$runButton.addClass('btn-secondary');
		$runButton.attr('disabled','disabled');
		$runButton.removeClass('btn-primary');
	}
}

function fileReadSuccess(csv, id) {
	var $item = jQuery('#' + id);
	$item.find('.progress').remove();
	$item.addClass('list-group-item-success');

	var isBase = $item.parent().attr('branch') == 'base';
	var isFeature = $item.parent().attr('branch') == 'feature';
	
	if (isBase) {
		baseFiles[id] = csv;
	} else if (isFeature) {
		featureFiles[id] = csv;
	}

	refreshValidation();
}

function fileReadError(error, id) {
	var $item = jQuery('#' + id);
	$item.find('.progress').remove();
	$item.addClass('list-group-item-danger');

	var $errorMsg = jQuery('<div class="upload-error"></div>');
	$errorMsg.text (error);
	$item.append($errorMsg);
}

function fileAdded(file, $fileList) {
	var itemId = 'upload-' + newGuid();

	var reader = new FileReader();
	reader['item-id'] = itemId;
	reader.onload = function(event) {
		var model = Papa.parse(event.currentTarget.result, {dynamicTyping: true});
		if (model.errors.length < 1 && model.data.length > 0) {
			model.meta['filename'] = file.name;
			fileReadSuccess(model, event.currentTarget['item-id']);
		} else {
			fileReadError(validation.error, event.currentTarget['item-id']);
		}
	};
	reader.onerror = function(event) {
		fileReadError(event.currentTarget.error, event.currentTarget['item-id']);
	};

	var $li = jQuery('<li class="list-group-item selected-file-item"></li>');
	$li.attr('id', itemId);

	var $name = jQuery('<div class="file-name"></div>');
	$name.text(file.name);
	$li.append($name);

	var $progress = jQuery('<div class="file-upload-progress progress"><div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width: 100%"></div></div>');
	$li.append($progress);

	$fileList.append($li);

	// start reading the file. When it is done, calls the onload event defined above.

	if (file.name.split('.').pop() == 'csv') {
		reader.readAsBinaryString(file);
	} else {
		fileReadError('File type was not a csv.', itemId);
	}
}

function runButtonClicked () {
	var canRun = Object.keys(baseFiles).length > 0 && Object.keys(featureFiles).length > 0;
	if (!canRun) {
		return false;
	}

	$mainProgressText.text('Comparing data sets');
	jQuery('#input-data-container').fadeOut(300, function() {
		$(this).remove();
		jQuery('#progress-container').fadeIn(300, function () {
			beginAnalysis ();
		});
	});
}

function beginAnalysis () {
	var results = analyzeDataSets (Object.values(baseFiles), Object.values(featureFiles));
	if (!results) {
		handleAnalysisError ();
	} else {
		uploadReport (results);
	}
}

function setErrorInfo(headingText, mainErrorHtml, detailsHtml) {
	jQuery('#error-heading').text(headingText);
	jQuery('#error-main-text').html(mainErrorHtml);
	jQuery('#error-details').html(detailsHtml);
}

function handleAnalysisError () {
	jQuery('#progress-container').fadeOut(300, function () {
		setErrorInfo(
			'Analysis error',
			'The provided data could not be analyzed. Check the error details below, and re-check your data sets.',
			`<ul class="error-list"></ul>`
		);
		for(var i=0; i<reportErrors.length; i++) {
			jQuery('.error-list').append(`<li>${reportErrors[i]}</li>`);
		}
		jQuery('#error-container').fadeIn(300);
	});
}

function handleUploadError(error) {
	jQuery('#progress-container').fadeOut(300, function () {
		setErrorInfo(
			'Upload error',
			`<p>There was a problem uploading the report.</p>
			<p>You can <a id="manual-download-link" href="#">download the report JSON here</a>, and import it manually on the <a href="report.html">report page</html>.</p>`,
			''
		);
		jQuery('#manual-download-link').click(function() {
			downloadObjectAsJson (temporaryReport, `report-${newGuid()}`);
		});
		for(var i=0; i<reportErrors.length; i++) {
			jQuery('.error-list').append(`<li>${reportErrors[i]}</li>`);
		}
		jQuery('#error-container').fadeIn(300);
	});
}

function handleUploadSuccess (id) {
	window.location.href = `report.html?id=${id}`;
}

function uploadReport (analysisResults) {
	$mainProgressText.text('Uploading report');
	var json = JSON.stringify(analysisResults);
	temporaryReport = analysisResults;
	var b64 = btoa (json);
	Bucket.set(b64, handleUploadSuccess, handleUploadError);
}

function dropHandler(e) {
	var $column = jQuery(e.currentTarget);
	jQuery('.drag-over-alert').slideUp();

	for(var i=0; i<e.dataTransfer.files.length; i++) {
		var file = e.dataTransfer.files[i];
		fileAdded (file, $column.find('ul.upload-list').first());
	}

	e.preventDefault();
}

function dragOverHandler(e) {
	var $column = jQuery(e.currentTarget);
	$column.find('.drag-over-alert').slideDown();
	e.preventDefault();
}

jQuery(document).ready(function() {
	$mainProgressText = jQuery('#main-progress-text');

	jQuery('#footer-text').html(
		`iFit Performance Report Generator - ver. ${ReportVer}<br/>
		<a href="https://github.com/williamt-ifit/perf-aggregator">GitHub</div>`
	);

	bs_input_file();
	jQuery('#run-button').click (runButtonClicked);
});
