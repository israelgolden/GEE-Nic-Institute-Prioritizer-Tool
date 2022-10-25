// Add this following to the script and convert to assets
var HUC_12_Data = ee.FeatureCollection("users/PrioritizationCobenefitsTool/HUC_12_Master2"),
    counties = ee.FeatureCollection("TIGER/2018/Counties"),
    F_HUC_Scores = ee.FeatureCollection("users/PrioritizationCobenefitsTool/F_HUC_Scores"),
    NF_HUC_Scores = ee.FeatureCollection("users/PrioritizationCobenefitsTool/NF_HUC_Scores"),
    geometry = /* color: #23cba7 */ee.Geometry.MultiPoint();
// End of conversion to assets

/////////////////
//// READ ME ////
/////////////////

// This script lacks annotation except for headers for sections. To read a detailed
// account of the functional code please consult the PrioritizerBetaAnnotated Script
// or direct any questions to Israel Golden at israelagolden@gmail.com

// Last updated: July 2022

//////////////////////////////
////  Global Variables    ////
//////////////////////////////

var priority_number, NumberOfElementsAdded, HUC_12_Data2, SelectedSheds,
  CarbonWeight, PotCarbWeight, FlowWeight, NCNHPWeight, PDCWeight, PHWeight,
  ProAreaWeight, ResilienceWeight, SVIDistWeight, Area12Weight, Area32Weight,
  county1, county2, county3, county4, county5, county6, county7, county8, county9, county10,
  ChartPanel, aoi, HUC_Math, geometry;

////////////////////////////////////////////
////  Basic Map Visualization Settings  ////
////////////////////////////////////////////

Map.setControlVisibility({scaleControl: true, zoomControl: false});
var drawingTools = Map.drawingTools();
drawingTools.setShown(false);

while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var dummyGeometry =
    ui.Map.GeometryLayer({geometries: null, name: 'geometry', color: '23cba7'});
drawingTools.layers().add(dummyGeometry);

Map.centerObject(HUC_12_Data);
Map.style().set({cursor: 'crosshair'});
var HUC_STYLE = {color: '26458d', fillColor: '00000000', width:1.5};
var originalHUCLayer = HUC_12_Data.style(HUC_STYLE);
Map.addLayer(originalHUCLayer);

///////////////////////////////////////
////  Explore HUC Attributes Tool  ////
///////////////////////////////////////

var HIGHLIGHT_STYLE = {color: '81ecf1', fillColor: '81ecf1C0'};
var SEARCH_DISTANCE = 1;
function getProps(loc) {
  loc = ee.Dictionary(loc);
  var point = ee.Geometry.Point(loc.getNumber('lon'), loc.getNumber('lat'));
  var thisHUC = F_HUC_Scores.filterBounds(point.buffer(SEARCH_DISTANCE));
  var thisHUCAttributes = thisHUC
    .select({
      propertySelectors: ['NAME', 'CARB', 'POTSEQ', 'FLOW', 'RESILI',
      'BIODIV', 'PH', 'PH_PCT', 'PDC','PDC_PCT', 'UNPRO_PCT', 'SVIDIST_PC', 'ACRES12', 'GRID12_PCT', 'ACRES32', 'GRID32_PCT'],
      newProperties: ['Subwatershed', 'Tons of Carbon per acre', 'Kg of C sequestered/ac/year',
      'Mean TNC Flow Score', 'Mean TNC Resilience Score', 'NCNHP Biodiversity Score',
      'Pollinator Habitat Area (acres)','Percentage of HUC as Pollinator Habitat', 'Pollinator-dependent Crop Area (acres)',
      'Percentage of HUC as Pollinator-dependent Cropland', 'Percent Unprotected', 'Socially vulnerable percentage of HUC without access to green space',
      'Working Lands at risk of conversion (acres)', 'Percentage of Working Lands at risk of conversion', 'Natural space at risk of conversion (acres)', 'Percentage of Natural space at risk of conversion']
    })
      .map(function(ft) {
            return ft.set('system:click_distance', point.distance(ft.geometry()));
        })
      .sort('system:click_distance').first();

  var props = thisHUCAttributes.toDictionary();
    props.evaluate(function(props) {
    var str = "Sub-watershed: "  + props.Subwatershed + '\n';
      delete props.Subwatershed;
      Object.keys(props).forEach(function(i) {
        str = str + i + ': ' + props[i] + '\n';
      });
      info.setValue(str);
    });
  handleMapClick();
    function updateOverlay() {
      var overlay = thisHUC.style(HIGHLIGHT_STYLE);
      Map.layers().set(1, ui.Map.Layer(overlay));
    }
    function clearResults() {
      Map.layers().remove(Map.layers().get(1));
    }

  function handleMapClick() {
    clearResults();
    updateOverlay();
  }
}
var inspectbutton1 = ui.Button({
  label:'Explore HUC attributes',
  style: {position: 'bottom-left'},
  onClick: function() {
  Map.remove(inspectbutton1);
  Map.add(summarypanel);
  Map.onClick(getProps);
  }
});

var summarypanel = ui.Panel({style: {position: 'bottom-left', width: '22.5rem', height: '10rem'}});
var info = ui.Label({value: 'Click on a feature', style: {whiteSpace: 'pre'}});
var collapsebutton = ui.Button({
  label: 'Collapse HUC Summary',
  style: {position: 'bottom-left'},
  onClick: function() {
    Map.layers().remove(Map.layers().get(1));
    Map.remove(summarypanel);
    Map.add(inspectbutton1);
  }
});
summarypanel.add(info).add(collapsebutton);
Map.add(inspectbutton1);

///////////////////////////////////////////
////  GUI Construction + Functionality ////
///////////////////////////////////////////

/// * TITLE & DESCRIPTION * ///
var panel = ui.Panel({style: {width:'25%'}});
ui.root.insert(0, panel);
var intro = ui.Label('NC HUC-12 Conservation Prioritization Tool Beta',
  {fontWeight: 'bold', fontSize: '24px', margin: '10px 5px'});
var subtitle = ui.Label('This tool takes ecosystem services datasets'+
  ' summarized  at the HUC-12 sub-watershed level and allows users'+
  ' to prioritize HUCs within their area of interest based on their conservation goals.', {});
panel.add(intro).add(subtitle);

/// * INCLUDE/EXCLUDE ALREADY PROTECTED LANDS * ///
var filterLabel = ui.Label('Include or Exclude Protected Areas from Prioritization',
  {fontWeight:'bold', fontSize: '18px', margin:'10px 5px'});
var filterDescription = ui.Label('Use the drop-down menu below to either include or exclude already-protected' +
 ' areas (e.g. National Parks, conservation easements) from prioritization calculations. Default excludes protected lands.');
var filterChoice = ui.Select({
  items: ['Exclude already protected lands', 'Include already protected lands']
}).setValue('Exclude already protected lands');
panel.add(filterLabel).add(filterDescription).add(filterChoice);


/// * AOI SELECTION * ///
var AOIChoiceIndex = 8;
var AOILabel = ui.Label('Choose your Area of Interest',
  {fontWeight:'bold', fontSize: '18px', margin:'10px 5px'});
var AOIDescription = ui.Label({value: 'Use the dropdown menu below to select your area of interest. ' +
  'Options include selection by county, river basin, user-defined geometry, or the entire state.'
});

function addAOIPanelElements(AOIPanelElements, AOIChoiceIndex) {
  for (var i = 0; i < AOIPanelElements.length; i++) {
    panel.insert(AOIChoiceIndex + i, AOIPanelElements[i]);
  }
  return AOIPanelElements.length;
}

function ClearAOIPanel(AOIChoiceIndex, NumberOfElementsAdded) {
  var allWidgets = panel.widgets();
  for(var i = AOIChoiceIndex; i < NumberOfElementsAdded + AOIChoiceIndex; i++){
    panel.remove(allWidgets.get(AOIChoiceIndex));
  }
}
var AOIChoice = ui.Select({items:
      ['County',
      'River Basin',
      'User-defined Geometry',
      'Entire State'],
  onChange: function(key) {
    ClearAOIPanel(AOIChoiceIndex, NumberOfElementsAdded);
    if (key == 'County') NumberOfElementsAdded =
      addAOIPanelElements(CountyPanelElements, AOIChoiceIndex);
    else if (key == 'River Basin') NumberOfElementsAdded =
      addAOIPanelElements(basinPanelElements, AOIChoiceIndex);
    else if (key == 'User-defined Geometry') NumberOfElementsAdded =
      addAOIPanelElements(geomPanelElements, AOIChoiceIndex);
    else if (key == 'Entire State') NumberOfElementsAdded = 0;
  }
});
panel.add(AOILabel).add(AOIDescription).add(AOIChoice);

/// * DROPDOWN MENU SELECTION OPTION RESULTS * ///

// AOI: COUNTY SELECTION
  var selectCOI = ui.Label({value:'Select counties of interest',
    style: {fontSize: '18px', fontWeight: 'bold'}});
  var CountyRules = ui.Label('Select at least one county to consider HUC-12 units within.');
    var NC_Counties = counties.filter(ee.Filter.eq('STATEFP', '37'));
  var NC_County_List = NC_Counties.aggregate_array('NAME').distinct().sort();
  function CountyDDListener() {
    CountyPanelElements[CountyPanelElements.length - 1].unlisten();
    if((basinPanelElements.length - 2) >= 100) {
      return;
    }
    var newDD = ui.Select({items: [],
        placeholder:'Choose a county', onChange: CountyDDListener}
      );
    NC_County_List.evaluate(function(HUC_12_Data){
      newDD.items().reset(HUC_12_Data)});
    panel.insert(AOIChoiceIndex + CountyPanelElements.length, newDD);
    CountyPanelElements.push(newDD);
    NumberOfElementsAdded++;
    print(CountyPanelElements.length);
  }
    var InitialCountyDD = ui.Select({items: [],
    placeholder: 'Choose a county', onChange: CountyDDListener});

    NC_County_List.evaluate(function(HUC_12_Data){
    InitialCountyDD.items().reset(HUC_12_Data)});

  var CountyPanelElements = [selectCOI, CountyRules, InitialCountyDD];

// AOI: River Basin Selection
  var NC_Rivers_List = HUC_12_Data.aggregate_array('DWQ_Basin').distinct().sort();
  var SelectBasinOfInterest = ui.Label({value:'Select river basins of interest',
    style: {fontSize: '18px', fontWeight: 'bold'}});
  var BasinRules = ui.Label('Select at least one river Basin to consider HUC-12 units within.');

  function RiverDDListener() {
    basinPanelElements[basinPanelElements.length - 1].unlisten();
    if((basinPanelElements.length - 2) >= 17) {
      return;
    }
    var newDD = ui.Select({items: [],
        placeholder:'Choose a basin', onChange: RiverDDListener}
      );
    NC_Rivers_List.evaluate(function(HUC_12_Data){
      newDD.items().reset(HUC_12_Data)});
    panel.insert(AOIChoiceIndex + basinPanelElements.length, newDD);
    basinPanelElements.push(newDD);
    NumberOfElementsAdded++;
  }

  var InitialBasinDD = ui.Select({items: [],
    placeholder: 'Choose a basin', onChange: RiverDDListener});
  NC_Rivers_List.evaluate(function(HUC_12_Data){
    InitialBasinDD.items().reset(HUC_12_Data)});
  var basinPanelElements = [SelectBasinOfInterest, BasinRules, InitialBasinDD];

/// AOI: USER-DEFINED GEOMETRY
  var aoi = drawingTools.layers().get(0).getEeObject();
  function clearGeometry() {
    var layers = drawingTools.layers();
    layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
  }
  function drawRectangle() {
    clearGeometry();
    drawingTools.setShape('rectangle');
    drawingTools.draw();
  }
  function drawPolygon() {
    clearGeometry();
    drawingTools.setShape('polygon');
    drawingTools.draw();
  }
  function stopDrawing() {
    drawingTools.stop();
  }
  var symbol = {
    rectangle: '⬛',
    polygon: '🔺',
    nodraw: '🙅️✏️'
  };
  var controlPanel = ui.Panel({
    widgets: [
      ui.Label('1. Select a drawing mode.'),
      ui.Button({
        label: symbol.rectangle + ' Rectangle',
        onClick: drawRectangle,
        style: {stretch: 'horizontal'}
      }),
      ui.Button({
        label: symbol.polygon + ' Polygon',
        onClick: drawPolygon,
        style: {stretch: 'horizontal'}
      }),
      ui.Button({
        label: symbol.nodraw + ' Stop Drawing',
        onClick: stopDrawing,
        style: {stretch: 'horizontal'}
      }),
      ui.Label('2. Draw a geometry.'),
      ui.Label('3. Once finished, click "Stop Drawing."'),
      ui.Label(
          '4. Repeat 1-3 to edit/move\ngeometry or proceed to weights.',
          {whiteSpace: 'pre'})
    ],
    layout: null,
  });
  var geomPanelElements = [controlPanel];

// AOI: ENTIRE STATE

/// * WEIGHT SLIDER SECTION * ///
var SpecifyWeights = ui.Label({value:'Specify weights for data layers',
style: {fontSize: '18px', fontWeight: 'bold'}});
var WeightExplanation = ui.Label({value:'In this section, weight your conservation ' +
    'interests relative to other conservation metrics. Click the title of any slider ' +
    'to see where the associated data comes from.'});

// Create 11 Weight sliders, one for each of the data layers
var WeightSlider = ui.Slider({min: 0, max: 10, value: 1, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider.style().set('stretch', 'horizontal');

var WeightSlider1 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider1.style().set('stretch', 'horizontal');

var WeightSlider2 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider2.style().set('stretch', 'horizontal');

var WeightSlider3 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider3.style().set('stretch', 'horizontal');

var WeightSlider4 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider4.style().set('stretch', 'horizontal');

var WeightSlider5 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider5.style().set('stretch', 'horizontal');

var WeightSlider6 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider6.style().set('stretch', 'horizontal');

var WeightSlider7 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider7.style().set('stretch', 'horizontal');

var WeightSlider8 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider8.style().set('stretch', 'horizontal');

var WeightSlider9 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider9.style().set('stretch', 'horizontal');

var WeightSlider10 = ui.Slider({min: 0, max: 10, value: 0, step: 0.1,
  style: {margin: '3px 8px 8px 14px'}});
  WeightSlider10.style().set('stretch', 'horizontal');

var SpecifyWeights = ui.Label({value:'Specify weights for data layers',
style: {fontSize: '18px', fontWeight: 'bold'}});

// Create labels for each of the sliders
var CarbLabel = ui.Label({value:'Standing carbon',
  style: {fontSize: '16px'}})
  .setUrl('https://usfs.maps.arcgis.com/home/item.html?id=4a604935bdce4a6eb77a967fab47ddff');

var PotCarbLabel = ui.Label({value:'Carbon sequester potential',
  style: {fontSize: '16px'}})
  .setUrl('https://www.nature.org/en-us/newsroom/forest-carbon-hotspots-identified-us/');

var FlowLabel = ui.Label({value:'TNC connected-ness',
  style: {fontSize: '16px'}})
  .setUrl('https://maps.tnc.org/resilientland/');

var NCNHPLabel = ui.Label({value:'NCNHP biodiversity',
  style: {fontSize: '16px'}})
  .setUrl('https://www.ncnhp.org/biodiversity-and-wildlife-habitat-assessment');

var PDCLabel = ui.Label({value:'Pollinator-dependent cropland',
  style: {fontSize: '16px'}})
  .setUrl('https://www.sciencebase.gov/catalog/item/5e90934682ce172707ec2934');

var PHLabel = ui.Label({value:'Pollinator habitat',
  style: {fontSize: '16px'}})
  .setUrl('https://www.sciencebase.gov/catalog/item/5e90934682ce172707ec2934');

var ProAreaLabel = ui.Label({value:'Unprotected area',
  style: {fontSize: '16px'}})
  .setUrl('https://www.ncnhp.org/activities/conservation/managed-areas');

var ResLabel = ui.Label({value:'TNC resilience',
  style: {fontSize: '16px'}})
  .setUrl('https://maps.tnc.org/resilientland/');

var SVIDLabel = ui.Label({value:'High SVI & lack of green space',
  style: {fontSize: '16px'}})
  .setUrl('https://www.atsdr.cdc.gov/placeandhealth/svi/index.html');

var Area12Label = ui.Label({value:'Working land conversion risk',
  style: {fontSize: '16px'}})
  .setUrl('https://www.epa.gov/gcx/about-iclus');

var Area32Label = ui.Label({value:'Natural land conversion risk',
  style: {fontSize: '16px'}})
  .setUrl('https://www.epa.gov/gcx/about-iclus');

panel.add(SpecifyWeights).add(WeightExplanation).add(CarbLabel).add(WeightSlider)
  .add(PotCarbLabel).add(WeightSlider1).add(FlowLabel).add(WeightSlider2)
  .add(NCNHPLabel).add(WeightSlider3).add(PDCLabel).add(WeightSlider4).add(PHLabel)
  .add(WeightSlider5).add(ProAreaLabel).add(WeightSlider6).add(ResLabel).add(WeightSlider7)
  .add(SVIDLabel).add(WeightSlider8).add(Area12Label).add(WeightSlider9)
  .add(Area32Label).add(WeightSlider10);

/// * SELECT PRIORITY HUCS NUMBER * ///
var PriorityHUCsLabel = ui.Label('Select priority number',
{fontWeight:'bold', fontSize: '18px', margin:'10px 5px'});
var priorityHUCsValue = ui.Label('Upon running the scenario, the top-ranking HUCs based ' +
  'on your inputs will be added to a series of charts on the right side of the screen. ' +
  'To enhance legibility, select how many of the top HUCs you wish to include in the ' +
  'charts (e.g., the top 3, top 5, or top 100). These HUCs will also be outlined in ' +
  'purple on the map. To add labels to the top HUCs, check the "High performing ' +
  'HUC labels" checkbox in the "Layers" dropdown menu in the top right.');
var HUCNumberbox = ui.Textbox("Default value is 3");
panel.add(PriorityHUCsLabel).add(priorityHUCsValue).add(HUCNumberbox);

/// * SUBMIT SCENARIO + CREDITS * ///
var ScenarioSection = ui.Label({value:'Scenario Submission',
style: {fontWeight: 'bold', fontSize: '24px'}
});
var ScenarioLabel = ui.Label({value:'Once you have selected your your area of interest, relative weights, and number of top-performing HUCs ' +
'press the "Run Scenario" button. Scenario outputs include a visualized map of prioritized HUCs, a series of charts of top performing HUCs ' +
'and associated co-benefits, and a downloadable spreadsheet of the attributes of all HUCs within the area of interest.  ' +
'Press the "Reset Map" button to submit another scenario. Allow 5-10 seconds for calculations.'
});
var SubmitScenario = ui.Button('Run Scenario', PrioritizerTool);
panel.add(ScenarioSection).add(ScenarioLabel).add(SubmitScenario);

var credits = ui.Label({
  value: 'Developed by Israel Golden, 2022\nemail: israel.golden@duke.edu',
  style: {color: 'gray',
          whiteSpace: 'pre',
          fontSize: '8 px'
  }
});

panel.add(credits);

//////////////////////////////////////////////
////  PRIORITIZER TOOL FUNCTION + INPUTS  ////
//////////////////////////////////////////////
function GetCurrentValues() {
  priority_number = Number(HUCNumberbox.getValue());
    if (!priority_number) priority_number = 3;
  aoi = drawingTools.layers().get(0).getEeObject();
  CarbonWeight = WeightSlider.getValue();
  PotCarbWeight = WeightSlider1.getValue();
  FlowWeight = WeightSlider2.getValue();
  NCNHPWeight = WeightSlider3.getValue();
  PDCWeight = WeightSlider4.getValue();
  PHWeight = WeightSlider5.getValue();
  ProAreaWeight = WeightSlider6.getValue();
  ResilienceWeight = WeightSlider7.getValue();
  SVIDistWeight = WeightSlider8.getValue();
  Area12Weight = WeightSlider9.getValue();
  Area32Weight = WeightSlider10.getValue();
}

function PrioritizerTool()
{
  Map.clear();
  Map.setControlVisibility({scaleControl: true, zoomControl: false});
  drawingTools.setShown(false);
  stopDrawing();
  GetCurrentValues();

/// * HUC EXPLORER * ///
var SEARCH_DISTANCE = 1;
function getProps(loc) {
  loc = ee.Dictionary(loc);
  var point = ee.Geometry.Point(loc.getNumber('lon'), loc.getNumber('lat'));
  var thisHUC = HUC_Math.filterBounds(point.buffer(SEARCH_DISTANCE));
  var thisHUCAttributes = thisHUC
    .select({
      propertySelectors: ['NAME', 'CARB', 'POTSEQ', 'FLOW', 'RESILI',
      'BIODIV', 'PH', 'PH_PCT', 'PDC','PDC_PCT', 'UNPRO_PCT', 'SVIDIST_PC', 'ACRES12', 'GRID12_PCT', 'ACRES32', 'GRID32_PCT'],
      newProperties: ['Subwatershed', 'Tons of Carbon per acre', 'Kg of C sequestered/ac/year',
      'Mean TNC Flow Score', 'Mean TNC Resilience Score', 'NCNHP Biodiversity Score',
      'Pollinator Habitat Area (acres)','Percentage of HUC as Pollinator Habitat', 'Pollinator-dependent Crop Area (acres)',
      'Percentage of HUC as Pollinator-dependent Cropland', 'Percent Unprotected', 'Socially vulnerable percentage of HUC without access to green space',
      'Working Lands at risk of conversion (acres)', 'Percentage of Working Lands at risk of conversion', 'Natural space at risk of conversion (acres)', 'Percentage of Natural space at risk of conversion']
    })
    .map(function(ft) {
      return ft.set('system:click_distance', point.distance(ft.geometry()));
  })
  .sort('system:click_distance').first();
  var props = thisHUCAttributes.toDictionary();
  props.evaluate(function(props) {
    var str = "Sub-watershed: "  + props.Subwatershed + '\n';
    delete props.Subwatershed;
    Object.keys(props).forEach(function(i) {
      str = str + i + ': ' + props[i] + '\n';
    });
    info.setValue(str);
  });
  handleMapClick();
  function updateOverlay() {
    var HIGHLIGHT_STYLE = {color: '81ecf1', fillColor: '81ecf1C0'};
    var overlay = thisHUC.style(HIGHLIGHT_STYLE);
    Map.layers().set(4, ui.Map.Layer(overlay));
  }
  function clearResults() {
    Map.layers().remove(Map.layers().get(4));
  }
  function handleMapClick() {
    clearResults();
    updateOverlay();
  }
}
var inspectbutton = ui.Button({
  label:'Explore HUC attributes',
  style: {position: 'bottom-left'},
  onClick: function() {
  Map.remove(inspectbutton);
  Map.add(summarypanel);
  Map.onClick(getProps);
  }
});
var summarypanel = ui.Panel({style: {position: 'bottom-left', width: '300px', height: '200px'}});
var info = ui.Label({value: 'Click on a feature', style: {whiteSpace: 'pre'}});
var collapsebutton = ui.Button({
  label: 'Collapse HUC Summary',
  onClick: function() {
    Map.layers().remove(Map.layers().get(4));
    Map.remove(summarypanel);
    Map.add(inspectbutton);
  }
});
summarypanel.add(info).add(collapsebutton);
Map.add(inspectbutton);

/// * INCLUDE/EXCLUDE ALREADY PROTECTED LANDS * ///
    if (filterChoice.getValue() == 'Exclude already protected lands'){
    HUC_12_Data2 = F_HUC_Scores;
      }
    else if (filterChoice.getValue() == 'Include already protected lands'){
    HUC_12_Data2 = NF_HUC_Scores;
      }
    else if (filterChoice.getValue() === ''){
      HUC_12_Data2 == F_HUC_Scores;
    }

/// * AOI SELECTION * ///
  if (AOIChoice.getValue() == 'County'){
    var SelectedCounties = [];
    for (var i=2; i < CountyPanelElements.length; i++){
      SelectedCounties.push(
          CountyPanelElements[i].getValue());
    }
    var CountySelection = NC_Counties.filter(
      ee.Filter.inList('NAME', SelectedCounties)
    );
    SelectedSheds = HUC_12_Data2.filterBounds(CountySelection);
  }
  else if (AOIChoice.getValue() == 'River Basin') {
    var SelectedBasins = [];
    for (var i=2; i < basinPanelElements.length; i++){
      SelectedBasins.push(
          basinPanelElements[i].getValue());
    }
    SelectedSheds = HUC_12_Data2.filter(SelectedBasins);
    SelectedSheds = HUC_12_Data2.filter(
      ee.Filter.inList('DWQ_Basin', SelectedBasins)
    );
  }
  else if (AOIChoice.getValue() == 'User-defined Geometry') {
    SelectedSheds = HUC_12_Data2.filterBounds(aoi);// so the issue is that it's not picking up a geometry value
    clearGeometry();
  }
  else if (AOIChoice.getValue() == 'Entire State') {
    SelectedSheds = HUC_12_Data2;
  }

  var addField = function(feature) {
      var wCarbon = ee.Number(feature.get('P_CARB')).multiply(ee.Number(CarbonWeight));
      var wPotCarb = ee.Number(feature.get('P_POTSEQ')).multiply(ee.Number(PotCarbWeight));
      var wFlow = ee.Number(feature.get('P_FLOW')).multiply(ee.Number(FlowWeight));
      var wNCNHP = ee.Number(feature.get('P_BIODIV')).multiply(ee.Number(NCNHPWeight));
      var wPDC = ee.Number(feature.get('P_PDC')).multiply(ee.Number(PDCWeight));
      var wPH = ee.Number(feature.get('P_PH')).multiply(ee.Number(PHWeight));
      var wProArea = ee.Number(feature.get('P_UNPRO')).multiply(ee.Number(ProAreaWeight));
      var wResili = ee.Number(feature.get('P_RESILI')).multiply(ee.Number(ResilienceWeight));
      var wSVIDist = ee.Number(feature.get('P_SVIDIST')).multiply(ee.Number(SVIDistWeight));
      var wArea12 = ee.Number(feature.get('P_GRID12')).multiply(ee.Number(Area12Weight));
      var wArea32 = ee.Number(feature.get('P_GRID32')).multiply(ee.Number(Area32Weight));

      var weight = wCarbon.add(wPotCarb).add(wFlow).add(wNCNHP).add(wPDC).add(wPH)
      .add(wProArea).add(wResili).add(wSVIDist).add(wArea12).add(wArea32);

    return feature.set({'weight': weight});
  };
  var HUC_Math = SelectedSheds.map(addField);
    var highPriority = HUC_Math
    .sort('weight', false)
    .limit(priority_number);

//2. Visualization

  // Determine max and min for visualization
      var WeightMax = ee.Number(HUC_Math.aggregate_stats('weight').get('max'));
      var visMax = WeightMax.getInfo();
      var WeightMin = ee.Number(HUC_Math.aggregate_stats('weight').get('min'));
      var visMin = WeightMin.getInfo();
    // High priority HUCs
      var WeightMax2 = ee.Number(highPriority.aggregate_stats('weight').get('max'));
      var visMax2 = WeightMax2.getInfo();
      var WeightMin2 = ee.Number(highPriority.aggregate_stats('weight').get('min'));
      var visMin2 = WeightMin2.getInfo();

  // First Visualize all HUC-12 units on gradient
    // Visualize the result by painting with the weight column
    var result = ee.Image().byte();
    var NC_result = result.paint({
      featureCollection: HUC_Math,
      color: 'weight',
    });
    var palette = ['#440154', '#433982', '#30678D', '#218F8B', '#36B677',
        '#8ED542', '#FDE725'];
    Map.addLayer(NC_result, {palette: palette, min: visMin, max: visMax},
        'HUC prioritization');

  var shown = false; // true or false, 1 or 0
  var opacity = 0.001; // number [0-1]
  var nameLayer = 'HUCs within AOI'; // string
  var visParams = {color: 'black', fillColor: 'ffffff'}; // dictionary:
  Map.addLayer(SelectedSheds, visParams, nameLayer, shown, opacity);

  var HUCref = ee.Image().byte();
  var HUCref_layer = HUCref.paint({
    featureCollection: HUC_Math,
    color: 'white',
    width: 1
  });
  Map.addLayer(HUCref_layer, {palette: 'black', opacity: 0.1}, 'HUC Reference Layer');

    var result2 = ee.Image().byte();
    var high_pri = result2.paint({
      featureCollection: highPriority,
      color: 'weight',
      width: 2
    });
    var palette2 = ['ffff74','fcfc55','fcfc2e','ffff00'];
    Map.addLayer(high_pri, {palette: '8856a7', min: visMin2, max: visMax2}, 'High priority HUCs');
    Map.centerObject(HUC_Math);

    var text = require('users/gena/packages:text');
    var scale = Map.getScale() * 1;
      var labels = highPriority.map(function(feat) {
        feat = ee.Feature(feat);
        var name = ee.String(feat.get("NAME"));
        var centroid = feat.geometry().centroid();
        var t = text.draw(name, centroid, scale, {
          fontSize:16,
          textColor:'white',
          outlineWidth: 2,
          outlineColor: 'black'
        });
        return t;
      });

      labels = ee.ImageCollection(labels);
      Map.addLayer(labels, {},'High performing HUC labels', false);

// 3. Table information for .csv download
    var highPriorityList = highPriority
      .reduceColumns(ee.Reducer.toList(), ['NAME']).get('list');
    var rankedTable = HUC_Math.sort('weight', false).select({
      propertySelectors: ['NAME','HUC12', 'ACRES','CARB', 'POTSEQ', 'FLOW', 'RESILI',
      'BIODIV', 'PH', 'PH_PCT', 'PDC','PDC_PCT', 'UNPRO_PCT', 'SVIDIST_PC', 'ACRES12', 'GRID12_PCT', 'ACRES32', 'GRID32_PCT','weight'],
      newProperties: ['Subwatershed','HUC 12 code', 'Acres', 'Tons of forest carbon per acre', 'Kg of C sequestered/ac/year',
      'Mean TNC flow score', 'Mean TNC resilience score', 'Mean NCNHP biodiversity score',
      'Pollinator habitat area (acres)','Percentage of HUC as pollinator habitat', 'Pollinator-dependent crop area (acres)',
      'Percentage of HUC as pollinator-dependent cropland', 'Percent unprotected', 'Percentage of HUC meeting SVI/green space conditions',
      'Working lands at risk of conversion (acres)', 'Percentage of working lands at risk of conversion',
      'Natural space at risk of conversion (acres)', 'Percentage of natural space at risk of conversion', 'Weighted score']
    });
var table = ui.Chart.feature.byFeature(rankedTable, 'Subwatershed');
  table.setChartType('Table');
  table.setOptions({allowHtml: true, pageSize: 10});
  table.style().set({stretch: 'both'});

//4. Graphs
    // Standing forest carbon
    var CarbonChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('CARB|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Tons per acre'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Tons of Carbon per acre in HUCs',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Tons of Carbon',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'fbd524'
              ]
            });

    // potential sequestration
    var PotSeqChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('POTSEQ|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Kilograms'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Potential sequestered carbon by HUC (kg/ac/year)',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Kg of Carbon/acre/year',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'fdb42f'
              ]
            });

    // Mean Flow
    var FlowChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('FLOW|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'HUC Score'
            ])
            .setChartType('ScatterChart')
            .setOptions({
              title: 'Mean TNC Flow Score by HUC',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Mean Flow',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'f89540'
              ]
            });

    // Mean resilience
    var ResChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('RESILI|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'HUC Score'
            ])
            .setChartType('ScatterChart')
            .setOptions({
              title: 'Mean TNC Resilience Score by HUC',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Mean TNC Resilience Score',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'ed7953'
              ]
            });

    // NCNHP Biodiversity
    var BiodivChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('BIODIV|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'HUC Score'
            ])
            .setChartType('ScatterChart')
            .setOptions({
              title: 'Mean NCNHP Biodiversity Score by HUC',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Mean NCNHP Biodiversity Score',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'de5f65'
              ]
            });

    // Pollinator Habitat
    var PHChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('PH|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Acres'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Pollinator Habitat (acres) by HUC',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Pollinator Habitat (acres)',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'cc4778'
              ]
            });

    // Pollinator Dependent Cropland
    var PDCChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('PDC|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Acres'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Pollinator Dependent Cropland (acres) by HUC',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Pollinator Dependent Cropland (acres)',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                'b52f8c'
              ]
            });

    // SVI + Dist Chart
    var SVIDChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('SVIDIST|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Acres'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Acres of socially vulnerable areas without access to greenspace by HUC',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'High SVI without greenspace (acres)',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                '9c179e'
              ]
            });

    // UNPRO Chart
    var UNPRO_Chart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('UNPRO_PCT|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Percent'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Percentage of HUC that is unprotected',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Percentage of HUC that is unprotected',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                '7e03a8'
              ]
            });


    // Working Land Conversion
    var WLChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('ACRES12|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Acres'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Working Lands projected to be developed by 2050 by HUC (acres)',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Projected Development (acres)',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                '5c01a6'
              ]
            });

    // Natural Land Conversion
    var NLChart =
        ui.Chart.feature
            .byFeature({
              features: highPriority.select('ACRES32|NAME'),
              xProperty: 'NAME',
            })
            .setSeriesNames([
              'Acres'
            ])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Natural Lands projected to be developed by 2050 by HUC (acres)',
              hAxis:
                  {title: 'HUC 12 Unit', titleTextStyle: {italic: false, bold: true}},
              vAxis: {
                title: 'Projected Development (acres)',
                titleTextStyle: {italic: false, bold: true}
              },
              colors: [
                '3a049a'
              ]

            });


/// * Results Panel * ///
var ChartLabel = ui.Label({value:'Co-benefits charts',
  style: {fontWeight:'bold', fontSize: '18px', margin:'10px 5px'}
});
var ChartDescription = ui.Label('HUCs are arranged on each chart in order of descending ' +
'conservation priority based on user input weight values.');

var TableLabel = ui.Label({value:'HUC attribute table',
  style: {fontWeight:'bold', fontSize: '18px', margin:'10px 5px'}
});
var TableDescription = ui.Label('This table includes all HUC-12 units within the area of interest and sorts them by weighted score ' +
  'in descending order. Click the expansion button in the top right to open the full table in another tab. Once opened, the table ' +
  'containing the HUC attributes can be downloaded as a .csv file and attached to a shapefile on a desktop GIS.');
var ChartPanel = ui.Panel({style: {width:'20%'}});
ui.root.insert(2, ChartPanel);

ChartPanel.add(ChartLabel).add(ChartDescription).add(CarbonChart)
.add(PotSeqChart).add(FlowChart).add(ResChart).add(BiodivChart).add(PHChart)
.add(PDCChart).add(SVIDChart).add(UNPRO_Chart).add(WLChart).add(NLChart)
.add(TableLabel).add(TableDescription).add(table);

// 5. Legend!
var viz = {min:visMin, max:visMax,
  palette:['#440154', '#433982', '#30678D', '#218F8B', '#36B677', '#8ED542', '#FDE725']};
var legend = ui.Panel({
style: {
position: 'bottom-right',
padding: '4px 8px'
}
});
var legendTitle = ui.Label({
value: 'HUC Ranking',
style: {
fontWeight: 'bold',
fontSize: '14px',
margin: '0 0 2px 0',
padding: '0'
}
});

legend.add(legendTitle);

var lon = ee.Image.pixelLonLat().select('latitude');
var gradient = lon.multiply((viz.max-viz.min)/100.0).add(viz.min);
var legendImage = gradient.visualize(viz);

var legendpanel = ui.Panel({
widgets: [
ui.Label({
  value: 'Highest priority',
  style: {
    fontSize: '10px'
  }
  })
],
});

legend.add(legendpanel);
 var thumbnail = ui.Thumbnail({
image: legendImage,
params: {bbox:'0,0,10,100', dimensions:'33x99'},
style: {padding: '1px', position: 'bottom-center'}
});
legend.add(thumbnail);
var legendpanel = ui.Panel({
widgets: [
ui.Label({
  value: 'Lowest priority',
  style: {
    fontSize: '10px'
  }
})],
});

legend.add(legendpanel);
Map.add(legend);

// 6. Reset Button
function reset(){
    Map.clear();
    clearGeometry();
    drawingTools.setShown(false);
    Map.setControlVisibility({scaleControl: true, zoomControl: false});
    ui.root.remove(ChartPanel);
    Map.addLayer(originalHUCLayer);
    Map.add(inspectbutton1);
    panel.remove(resetButton);
    panel.remove(credits);
    panel.add(SubmitScenario);
    panel.add(credits);
  }
panel.remove(SubmitScenario);
panel.remove(credits);
var resetButton = ui.Button('Reset Map', reset);
panel.add(resetButton);
panel.add(credits);
}
