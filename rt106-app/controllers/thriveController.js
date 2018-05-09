// Copyright (c) General Electric Company, 2017.  All rights reserved.

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['angular', '../module'], factory);
    } else {
        // Browser globals
        root.thriveController = factory(angular, angular.module('rt106'));
    }
}(this, function(angular, mod) {

    'use strict';

    mod.controller('thriveController', ['$scope', '$http', '$location', 'cohortFactory', 'pathologyService', 'analyticsFactory', 'dynamicDisplayService', 'executionService', 'alarmService', 'utilityFns', 'Rt106_SERVER_URL', function($scope, $http, $location, cohortFactory, pathologyService, analyticsFactory, dynamicDisplayService, executionService, alarmService, utilityFns, Rt106_SERVER_URL) {

        /*
         * $scope variables
         */
        $scope.slides = [];
        $scope.regions=[];
        $scope.channels=[];
        $scope.selectedSlide="";
        $scope.selectedRegion="";
        $scope.selectedChannel="";
        $scope.imageLayout = "1,1";

        $scope.executionList  = [];     // Dynamically-changing execution list.
        $scope.selectedAlgo   = "";     // Algorithms that is selected in the GUI.  Only one at a time can be selected.
        $scope.selectedParameters = []; // Parameters for the selected algorithm.

        $scope.pipelines = [];
        $scope.newPipelineName = "";
        $scope.forceOverwrite = false;

        $scope.algoComments = [];
        $scope.algoEval = [];
        $scope.selectedGridRow = -1;
        $scope.rectangleInfo = "";
        $scope.selectedCells = "";
        $scope.cellsInfo = "";

        $scope.gridColumns = [];

        // The UI can display plots and other information on a set of user-selected features.
        $scope.feature1 = 0;
        $scope.feature2 = 0;
        $scope.feature3 = 0;
        $scope.feature4 = 0;
        $scope.diversity = 0;
        $scope.feature1list=[];
        $scope.feature2list=[];
        $scope.feature3list=[];
        $scope.feature4list=[];
        $scope.diversityList=[];
        $scope.feature1name="";
        $scope.feature2name="";
        $scope.feature3name="";
        $scope.feature4name="";
        $scope.feature1index=-1; // not currently used?

        /*
         * Initialization
         */

        function initSlides() {
            pathologyService.getSlideList()
                .then(function(slides) {
                    $scope.slides = slides;
                }).catch(function(error) {
                console.error("Error returned from slides promise: " + error);
            });
            if ($scope.slides == "not ready") {
                console.log("Slide list not ready, will try again in 1 second.")
                setTimeout(initSlides, 1000);
            }
        }
        initSlides();

        function getRegions(slide) {
            pathologyService.getRegionList(slide)
                .then(function(regions) {
                    $scope.regions = regions;
                }).catch(function(error) {
                    console.error("Error returned from regions promise: " + error);
            });
            if ($scope.regions == "not ready") {
                console.log("Region list not ready, will try again in 1 second.")
                setTimeout(function() {
                    getRegions(slide);
                }, 1000);
            }
        }

        function getChannels(slide,region) {
            pathologyService.getChannelList(slide,region)
                .then(function(channels) {
                    $scope.channels = channels;
                }).catch(function(error) {
                console.error("Error returned from channels promise: " + error);
            });
            if ($scope.channels == "not ready") {
                console.log("Channel list not ready, will try again in 1 second.")
                setTimeout(function() {
                    getChannels(slide,region);
                }, 1000);
            }
        }

        // Set up for running algorithms.
        executionService.initExecution();

        // Initialize the list of algorithms and scan periodically for changes in the list.
        var scanForAnalytics = function() {
            analyticsFactory.getAnalytics().then(function(analytics) {
                utilityFns.mergeAnalyticsLists($scope.algorithms, analytics, $scope.selectedAlgo);
                // Idenfity the algorithms that are for pathology.
                $scope.algorithmsSegmentation = [];
                $scope.algorithmsQuantitation = [];
                $scope.algorithmsHeterogeneity = [];
                for (var i=0; i < $scope.algorithms.length; i++) {
                    var classLevels = $scope.algorithms[i].classification.split('/');
                    if (classLevels[1] == "cell") {
                        if (classLevels[0] == "segmentation") {
                            $scope.algorithmsSegmentation.push($scope.algorithms[i]);
                        } else if (classLevels[0] == "quantification") {
                            $scope.algorithmsQuantitation.push($scope.algorithms[i]);
                        } else if (classLevels[0] == "heterogeneity") {
                            $scope.algorithmsHeterogeneity.push($scope.algorithms[i]);
                        }
                    }
                }
                utilityFns.updateScroll($scope);
                setTimeout(scanForAnalytics, 5000);
            });
        }
        setTimeout(scanForAnalytics, 1000);

            // Start polling for execution results.
        function pollExecList() {
            executionService.pollExecList($scope.executionList, $scope).then(function () {
                setTimeout(pollExecList, 1000);
            });
        }
        setTimeout(pollExecList, 1000);

        // Periodically make sure that scrollbars are in the right state.
        setInterval(function() { utilityFns.updateScroll($scope); }, 1000);

        /*
         * Handlers for user actions in the user interface.
         */

        $scope.clickSlide = function () {
            getRegions($scope.selectedSlide);
        }

        $scope.clickRegion = function () {
            getChannels($scope.selectedSlide,$scope.selectedRegion);
            $scope.displayImage();
        }

        $scope.clickChannel = function () {
            $scope.displayImage();
        }

        $scope.updatePipelineList = function() {
            // Check that selectedSlide and selectedRegion are not "".
            if ($scope.selectedSlide != "" && $scope.selectedRegion != "") {
                // Get the list of pipelines for this slide and region.
                var querystring = Rt106_SERVER_URL + '/v1/datastore/pathology/slides/' + $scope.selectedSlide + '/regions/' + $scope.selectedRegion + '/results';
                $http.get(querystring)
                    .then(function (results) {
                        $scope.pipelines = results.data;
                        // Remove 'Source' from the list, which is not actually a pipeline.
                        var sourceid = $scope.pipelines.indexOf('Source');
                        if (sourceid > -1) {
                            $scope.pipelines.splice(sourceid, 1);
                        }
                        // Add 'default' as the first choice in the list if it is not already there.
                        var defid = $scope.pipelines.indexOf('default');
                        if (defid == -1) {
                            $scope.pipelines.unshift('default');
                        }
                        $scope.selectedPipeline='default';
                    }, function(err) {
                        var errorstring = querystring + ' returned an error.' + err.data;
                        $log.error(errorstring);
                        alarmService.displayAlert('Error getting pipelineids for ' + querystring);
                    });
            }
        }

        $scope.clickPipeline = function () {
            // Placeholder.
        }

        $scope.newPipelineID = function() {
            // If new name is not an empty string.
            if ($scope.newPipelineName !== "") {
                // If new name is not already in the list of pipeline names.
                if ($scope.pipelines.indexOf($scope.newPipelineName) == -1) {
                    $scope.pipelines.push($scope.newPipelineName);
                }
            }
        }

        /*
         * Image display.
         */
        $scope.displayImage = function() {
            if ($scope.selectedSlide == "") {
                console.log("Can't display, no slide selected.");
            } else if ($scope.selectedRegion == "") {
                console.log("Can't display, no region selected.");
            } else if ($scope.selectedChannel == "") {
                console.log("Can't display, no channel selected.");
            } else {
                // Get the path for the image to display.
                pathologyService.getPrimaryImagePath( $scope.selectedSlide, $scope.selectedRegion, $scope.selectedChannel )
                    .then(function(accessString) {
                        $scope.imageLayout = dynamicDisplayService.setDisplayShape("1,1");
                        var imageFormat = "tiff16:";
                        imageViewers.clearStackElements(imageViewers.stackViewers[0]);
                        dynamicDisplayService.displayInCell(imageFormat, accessString, {}, 0, 0, $scope.imageLayout, 'rgb(255,255,255)', 1.0, "");
                    }).catch(function(error){
                    console.error("Error returned from promise: " + error);
                    // display alarm.
                });
            }
        }
        // scan for algorithms every 5 seconds. note that getAnalytics() returns a promise
        // so the list of analytics displayed will be updated asynchronously
        $scope.algorithms = [];
        $scope.algorithmsSegmentation = [];
        $scope.algorithmsQuantitation = [];
        $scope.algorithmsHeterogeneity = [];

        $scope.clickPathologyAlgo = function(algo, highlightAlgos, algoCategory, algoSubIndex) {
            utilityFns.updateScroll($scope);
            if (highlightAlgos[algoCategory][algoSubIndex]) {
                $scope.selectedAlgo = algo.name;
                // Get the parameters for the selected algorithm.
                var algoIndex = utilityFns.getObjectIndexByValue($scope.algorithms, 'name', algo.name);
                $scope.selectedParameters = $scope.algorithms[algoIndex].parameters;
                // Unhighlight any other selected algorithms.
                for (var cat=0; cat<3; cat++) {  // 3 algorithm categories: segmentation, quantitation, heterogeneity
                    for (var subAlg in highlightAlgos[cat]) {
                        if (cat != algoCategory || subAlg != algoSubIndex) {
                            highlightAlgos[cat][subAlg] = false;
                        }
                    }
                }
            } else { // !expandAlgo
                $scope.selectedAlgo = "";
                $scope.selectedParameters = [];
            }
        }

        /*
         * Function for when the Execute! button is clicked.
         */
        $scope.requestAlgoRun = function () {
            executionService.autofillPathologyParameters($scope.selectedParameters, $scope.selectedSlide, $scope.selectedRegion, $scope.selectedChannel, $scope.selectedPipeline, $scope.forceOverwrite);
            executionService.requestAlgoRun($scope.selectedParameters, $scope.selectedAlgo);
        }

        /*
         * startingList should be a dictionary of strings mapped to indices.
         * blackList is a list of strings that should be omitted from the original list.
         * The items in blackList can be substrings such as prefixes or suffixes.
         */
        function filterList( startingList, blackList ) {
            var filteredList = Object();
            // Examine each item in startList relative to blackList.
            for (var listElement in startingList) {
                var keep=true;
                for (var i=0; i<blackList.length; i++) {
                    var omitElement = blackList[i];
                    if (listElement.search(omitElement) != -1) {
                        keep=false;
                        //break;
                    }
                }
                if (keep) {
                    //filteredList.push(listElement);
                    filteredList[listElement] = startingList[listElement];
                }
                console.log("Done with " + listElement);
            }
            return filteredList;
        }

        $scope.clickResult = function(execItem,expandResult) {
            console.log("In clickResult, execItem is " + JSON.stringify(execItem));
            utilityFns.updateScroll($scope);
            if (expandResult) {
                $scope.selectedExecution = execItem;
                // Get the analytic's ID in $scope.algorithms.
                var index = utilityFns.getObjectIndexByValue($scope.algorithms, 'name', execItem.analyticName);
                // Get the display structure for that analytic.
                var displayStruct = $scope.algorithms[index].display;
                // TODO:  This test should be based on classification of algorithm rather than name.
                if (execItem.analyticName == "CellQuantification--v1_0_0" ||
                    execItem.analyticName == "multi-compartment-cell-quantification--v1_0_0" ||
                    execItem.analyticName == "simple-heterogeneity-metrics--v1_0_0") {
                    var cellMetrics = execItem.result.cellMetrics;
                    // Get the cell quantification data from cellMetrics.
                    var uriString = Rt106_SERVER_URL + "/v1/dataconvert/csvtojson/v1/pathology/datafile" + cellMetrics;
                    $http.get(uriString)
                        .then(function(result) {
                            var cellList = result.data.cells;
                            setGridColumns(cellList[0]);
                            $scope.gridData = cellList;
                            $scope.gridApi.grid.refresh();
                            // Create a dictionary of the columns.
                            $scope.gridColumns = Object();
                            var firstRow = cellList[0];
                            var i = 0;
                            for(var param in firstRow) {
                                $scope.gridColumns[param] = i++;
                            }
                            // Filter out many of the fields, just leaving mean biomarker intensities.
                            $scope.gridColumns = filterList( $scope.gridColumns, ["Cell_ID", "Cell_Center", "Std", "Max", "Median", "Diversity", "^R$", "^G$", "^B$", "field"] );
                            // Cell calculations for full image.
                            $scope.calculateCellInfoInROI(0.0, 0.0, 2048.0, 2048.0);
                        }, function(err) {
                            console.error(uriString + ' returned an error.', err.data);
                        });
                } else {
                    // Display the result based on the displayStruct.
                    $scope.imageLayout = dynamicDisplayService.displayResult(execItem, displayStruct, {}, "1x1");
                }
            }
        }

        $scope.saveEvaluationToDB = function (execId) {
            var http_data = {
                'executionId' : execId,
                'evaluation' : $scope.algoEval[execId],
                'comments' : $scope.algoComments[execId]
            };
            var promise = $http.post(Rt106_SERVER_URL + '/v1/analytics/evaluation', http_data)
                .then(
                    function(response) {
                        // success callback
                        console.info('Post to ' + Rt106_SERVER_URL + '/v1/analytics/evaluation succeeded. ' + JSON.stringify(response));
                    },
                    function(response) {
                        // failure callback
                        console.info('Post to ' + Rt106_SERVER_URL + '/v1/analytics/evaluation failed. ' + JSON.stringify(response));
                    }
                );

        }

        // Functions for plots and quantitated cell table.

        // Print quartiles for testing.
        function printQuartiles(numberArray) {
            var sortedArray = numberArray.sort();
            var arrayLength = sortedArray.length;
            var quartile1 = Math.floor(arrayLength * 0.25);
            var quartile2 = Math.floor(arrayLength * 0.5);
            var quartile3 = Math.floor(arrayLength * 0.75);
            console.log("quartiles: " + sortedArray[quartile1] + ", " + sortedArray[quartile2] + ", " + sortedArray[quartile3]);
        }

        // FUNCTIONS FOR QUERYING THE IMAGE USING A RECTANGULAR ROI.

        $scope.updateRectangularROI = function () {
            console.log("Clicked on viewer!");
            $scope.frame = $("#imageWrapper1")[0];
            $scope.element = cornerstoneLayers.getImageElement($scope.frame);
            var boxDefined = true;
            var startX, startY, endX, endY;
            var rectangleToolState=undefined;
            if ($scope.element === undefined) {
                boxDefined=false;
            } else {
                rectangleToolState = cornerstoneTools.getToolState($scope.element, 'rectangleRoi');
                if (rectangleToolState === undefined) {
                    boxDefined=false;
                } else {
                    if (rectangleToolState.data.length === 0) {
                        // This can happen if there had been a box but it was deleted.
                        boxDefined=false;
                    }
                }
            }
            if (! boxDefined) {
                // no bounding box defined
                startX = 0;
                startY = 0;
                endX   = Infinity;
                endY   = Infinity;
            }
            else {
                startX = rectangleToolState.data[0].handles.start.x;
                startY = rectangleToolState.data[0].handles.start.y;
                endX   = rectangleToolState.data[0].handles.end.x;
                endY   = rectangleToolState.data[0].handles.end.y;
            }
            $scope.rectangleInfo = "( " + Math.round(startX) + " , " + Math.round(startY) +
                " ) to ( " + Math.round(endX) + " , " + Math.round(endY) + " )";
            $scope.calculateCellInfoInROI(startX, startY, endX, endY);
        }

        $scope.calculateCellInfoInROI = function (startX, startY, endX, endY) {
            var cellX, cellY, cellID;
            $scope.selectedCells = "";
            var count = 0;
            var feature1num, feature2num, feature3num, feature4num, diversityNum;
            var feature1sum = 0;
            var feature2sum = 0;
            var feature3sum = 0;
            var feature4sum = 0;
            var diversitySum = 0;
            $scope.feature1list = [];
            $scope.feature2list = [];
            $scope.feature3list = [];
            $scope.feature4list = [];
            $scope.diversityList = [];
            for (var i=0; i<$scope.gridData.length; i++) {
                // The cell values should be numbers already, but in case they are not...
                cellX = Number($scope.gridData[i].Cell_Center_X);
                cellY = Number($scope.gridData[i].Cell_Center_Y);
                cellID = $scope.gridData[i].Cell_ID;
                if (startX < cellX && cellX < endX && startY < cellY && cellY < endY) {
                    $scope.selectedCells = $scope.selectedCells + cellID + ",";
                    count = count + 1;
                    if ($scope.feature1name !== "") {
                        feature1num = Number($scope.gridData[i][$scope.feature1name]);
                        feature1sum  += feature1num;
                        $scope.feature1list.push(feature1num);
                    }
                    if ($scope.feature2name !== "") {
                        feature2num = Number($scope.gridData[i][$scope.feature2name]);
                        feature2sum  += feature2num;
                        $scope.feature2list.push(feature2num);
                    }
                    if ($scope.feature3name !== "") {
                        feature3num = Number($scope.gridData[i][$scope.feature3name]);
                        feature3sum  += feature3num;
                        $scope.feature3list.push(feature3num);
                    }
                    if ($scope.feature4name !== "") {
                        feature4num = Number($scope.gridData[i][$scope.feature4name]);
                        feature4sum  += feature4num;
                        $scope.feature4list.push(feature4num);
                    }

                    diversityNum = Number($scope.gridData[i].Diversity);
                    if (!isNaN(diversityNum)) {
                        diversitySum += diversityNum;
                        $scope.diversityList.push(diversityNum);
                    }
                }
            }
            $scope.feature1  = Math.round(feature1sum / count);
            $scope.feature2  = Math.round(feature2sum / count);
            $scope.feature3 = Math.round(feature3sum / count);
            $scope.feature4 = Math.round(feature4sum / count);
            $scope.diversity = Math.round(10000 * diversitySum / count) / 10000; // Round to 3 decimal places.
            $scope.cellsInfo = "There are " + count + " selected cells.";
            $scope.drawPlots();
            drawHistogram();
        }

        // FUNCTIONS FOR BIOMARKER BOX PLOTS

        $scope.feature1list=[];
        $scope.feature2list=[];
        $scope.feature3list=[];
        $scope.feature4list=[];

        /*
        // Box plot sample data for testing
        for (var i = 0; i < 50; i ++)
        {
            $scope.feature1list[i] = Math.random();
            $scope.feature2list[i] = 2*Math.random();
            $scope.feature3list[i] = 5*Math.random();
            $scope.feature4list[i] = 10*Math.random();
        }
        */

        $scope.drawPlots = function () {
            console.log("quartiles for " + $scope.feature1name + ":");
            printQuartiles($scope.feature1list);
            var feature1points = {
                y: $scope.feature1list,
                type: 'box',
                name: $scope.feature1name,
                boxpoints: false
            };

            var feature2points = {
                y: $scope.feature2list,
                type: 'box',
                name: $scope.feature2name,
                boxpoints: false
            };

            var feature3points = {
                y: $scope.feature3list,
                type: 'box',
                name: $scope.feature3name,
                boxpoints: false
            };

            var feature4points = {
                y: $scope.feature4list,
                type: 'box',
                name: $scope.feature4name,
                boxpoints: false
            };

            var data = [feature1points, feature2points, feature3points, feature4points];

            var layout = {
                title: 'Marker Expression within ROI',
            }

            Plotly.newPlot('boxPlot', data, layout);
        }
        $scope.drawPlots();


        // Initialize cell metrics and displays.
        $scope.gridData = [];
        $scope.calculateCellInfoInROI(0.0, 0.0, 0.0, 0.0);

        // FUNCTIONS FOR QUANTITATED CELL DATA

        function setGridColumns(sampleRow) {
            $scope.gridOptions.columnDefs = new Array();
            for (var key in sampleRow) {
                $scope.gridOptions.columnDefs.push({
                    name: key,
                    field: key,
                    width: 120
                });
            }
        }

        $scope.gridOptions = {
            enableFiltering: false,
            enableRowHeaderSelection: false,
            enableRowSelection: true,
            multiSelect: false,
            noUnselect: true,
            showGridFooter: true,
            enableGridMenu: true,
            data: 'gridData'
        }

        $scope.gridOptions.onRegisterApi = function (gridApi) {
            $scope.gridApi = gridApi;
            gridApi.selection.on.rowSelectionChanged($scope, function (row) {
                $scope.selectedGridRow = JSON.stringify(row.entity);
                $scope.gridApi.grid.appScope.lastSelectedRow = row;
        })}


        // FUNCTIONS FOR DIVERSITY HISTOGRAM

        /*
        //var diversity = [];
        for (var i = 0; i < 500; i ++) {
            $scope.diversityList[i] = Math.random();
        }
        */

        function drawHistogram() {
            var histoData = [
                {
                    title: 'Diversity within ROI',
                    x: $scope.diversityList,
                    type: 'histogram',
                    marker: {
                        color: 'rgba(100,250,100,0.7)',
                    }
                }
            ];
            var layout = {
                title: 'Diversity within ROI',
            }
            Plotly.newPlot('histogram', histoData, layout);
        }
        drawHistogram();


         $scope.gridData = [
         {
         "Cell_ID":"1.0",
         "Cell_Center_X":"0",
         "Cell_Center_Y":"0",
         "DAPI_Mean":"0",
         "DAPI_Std":"0",
         "DAPI_Median":"0",
         "DAPI_Max":"0"
         },
         {
         "Cell_ID":"2.0",
         "Cell_Center_X":"1546.8",
         "Cell_Center_Y":"1794.62",
         "DAPI_Mean":"13346.1",
         "DAPI_Std":"6166.02",
         "DAPI_Median":"14217.0",
         "DAPI_Max":"27726.0"
         },
         {
         "Cell_ID":"3.0",
         "Cell_Center_X":"817.559",
         "Cell_Center_Y":"757.84",
         "DAPI_Mean":"28816.9",
         "DAPI_Std":"6121.6",
         "DAPI_Median":"30221.0",
         "DAPI_Max":"35200.0"
         },
         {
         "Cell_ID":"4.0",
         "Cell_Center_X":"1352.33",
         "Cell_Center_Y":"1555.74",
         "DAPI_Mean":"26166.6",
         "DAPI_Std":"11403.8",
         "DAPI_Median":"27828.0",
         "DAPI_Max":"49589.0"
         },
         {
         "Cell_ID":"5.0",
         "Cell_Center_X":"1445.96",
         "Cell_Center_Y":"833.548",
         "DAPI_Mean":"19261.3",
         "DAPI_Std":"3568.69",
         "DAPI_Median":"19087.0",
         "DAPI_Max":"30368.0"
         }
         ];

    }]);

}));


