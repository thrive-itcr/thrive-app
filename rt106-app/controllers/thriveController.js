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

        // Hard-coded for some specific biomarkers.  TODO:  Make biomarkers selectable by user.
        $scope.S6 = 0;
        $scope.pS6235 = 0;
        $scope.pERK = 0;
        $scope.p4EBP1 = 0;
        $scope.diversity = 0;
        $scope.S6list=[];
        $scope.pS6235list=[];
        $scope.pERKlist=[];
        $scope.p4EBP1list=[];
        $scope.diversityList=[];

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
                    }, function(err) {
                        var errorstring = querystring + ' returned an error.' + err.data;
                        $log.error(errorstring);
                        alarmService.displayAlert('Error getting pipelineids for ' + querystring);
                    });
            }
        }

        $scope.clickPipeline = function () {
            // Placeholder.  All actions for clickPipeline() currently handled by AngularJS.
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

        $scope.clickOnViewer = function () {
            console.log("Clicked on viewer!");
            $scope.printRectangleInfo();
            var rectangleToolState = cornerstoneTools.getToolState($scope.element, 'rectangleRoi');
            var startX = rectangleToolState.data[0].handles.start.x;
            var startY = rectangleToolState.data[0].handles.start.y;
            var endX   = rectangleToolState.data[0].handles.end.x;
            var endY   = rectangleToolState.data[0].handles.end.y;
            $scope.calculateCellInfoInROI(startX, startY, endX, endY);
        }

        // FUNCTIONS FOR QUERYING THE IMAGE USING A RECTANGULAR ROI.

        $scope.printRectangleInfo = function () {
            $scope.frame = $("#imageWrapper1")[0];
            $scope.element = cornerstoneLayers.getImageElement($scope.frame);
            //$scope.rectangleInfo = "no info now";
            // TODO: catch errors in the lines below, which will happen if there is no rectangle.
            var rectangleToolState = cornerstoneTools.getToolState($scope.element, 'rectangleRoi');
            var startX = rectangleToolState.data[0].handles.start.x;
            var startY = rectangleToolState.data[0].handles.start.y;
            var endX   = rectangleToolState.data[0].handles.end.x;
            var endY   = rectangleToolState.data[0].handles.end.y;
            $scope.rectangleInfo = "( " + Math.round(startX) + " , " + Math.round(startY) +
                    " ) to ( " + Math.round(endX) + " , " + Math.round(endY) + " )";
        }

        $scope.calculateCellInfoInROI = function (startX, startY, endX, endY) {
            var cellX, cellY, cellID;
            $scope.selectedCells = "";
            var count = 0;
            // Hard coded for some specific biomarkers:  S6, pS6235, pERK, p4EBP1.
            var S6num, pS6235num, pERKnum, p4EBP1num, diversityNum;
            var S6sum = 0;
            var pS6235sum = 0;
            var pERKsum = 0;
            var p4EBP1sum = 0;
            var diversitySum = 0;
            $scope.S6list = [];
            $scope.pS6235list = [];
            $scope.pERKlist = [];
            $scope.p4EBP1list = [];
            $scope.diversityList = [];
            for (var i=0; i<$scope.gridData.length; i++) {
                // The cell values should be numbers already, but in case they are not...
                cellX = Number($scope.gridData[i].Cell_Center_X);
                cellY = Number($scope.gridData[i].Cell_Center_Y);
                cellID = $scope.gridData[i].Cell_ID;
                if (startX < cellX && cellX < endX && startY < cellY && cellY < endY) {
                    $scope.selectedCells = $scope.selectedCells + cellID + ",";
                    count = count + 1;
                    S6num = Number($scope.gridData[i].S6_Nuc_Mean);
                    S6sum  += S6num;
                    $scope.S6list.push(S6num);

                    pS6235num = Number($scope.gridData[i].pS6235_Nuc_Mean);
                    pS6235sum  += pS6235num;
                    $scope.pS6235list.push(pS6235num);

                    pERKnum = Number($scope.gridData[i].pERK_Nuc_Mean);
                    pERKsum += pERKnum;
                    $scope.pERKlist.push(pERKnum);

                    p4EBP1num = Number($scope.gridData[i].p4EBP1_Nuc_Mean);
                    p4EBP1sum += p4EBP1num;
                    $scope.p4EBP1list.push(p4EBP1num);

                    diversityNum = Number($scope.gridData[i].Diversity);
                    if (!isNaN(diversityNum)) {
                        diversitySum += diversityNum;
                        $scope.diversityList.push(diversityNum);
                    }
                }
            }
            $scope.S6  = Math.round(S6sum / count);
            $scope.pS6235  = Math.round(pS6235sum / count);
            $scope.pERK = Math.round(pERKsum / count);
            $scope.p4EBP1 = Math.round(p4EBP1sum / count);
            $scope.diversity = Math.round(10000 * diversitySum / count) / 10000; // Round to 3 decimal places.
            $scope.cellsInfo = "There are " + count + " selected cells.";
            drawPlots();
            drawHistogram();
        }

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


        // FUNCTIONS FOR BIOMARKER BOX PLOTS

        $scope.S6list=[];
        $scope.pS6235list=[];
        $scope.pERKlist=[];
        $scope.p4EBP1list=[];

        /*
        // Box plot sample data for testing
        for (var i = 0; i < 50; i ++)
        {
            $scope.S6list[i] = Math.random();
            $scope.pS6235list[i] = 2*Math.random();
            $scope.pERKlist[i] = 5*Math.random();
            $scope.p4EBP1list[i] = 10*Math.random();
        }
        */

        function drawPlots() {
            console.log("quartiles for S6: ");
            printQuartiles($scope.S6list);
            var S6points = {
                y: $scope.S6list,
                type: 'box',
                name: 'S6',
                boxpoints: false
            };

            var pS6235points = {
                y: $scope.pS6235list,
                type: 'box',
                name: 'pS6235',
                boxpoints: false
            };

            var pERKpoints = {
                y: $scope.pERKlist,
                type: 'box',
                name: 'pERK',
                boxpoints: false
            };

            var p4EBP1points = {
                y: $scope.p4EBP1list,
                type: 'box',
                name: 'p4EBP1',
                boxpoints: false
            };

            var data = [S6points, pS6235points, pERKpoints, p4EBP1points];

            var layout = {
                title: 'Marker Expression within ROI',
            }

            Plotly.newPlot('boxPlot', data, layout);
        }
        drawPlots();

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


