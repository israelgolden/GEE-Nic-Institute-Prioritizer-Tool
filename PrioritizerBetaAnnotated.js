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

// This script accompanies the PrioritizerBetaCode script but provides a more detailed
// explanation of how the code works. This script is intended to make modifying/updating
// the PrioritizerBetaCode script easy and understandable. I will work through each section
// of the script (top to bottom) and do my best to explain how each part works.
//
// If you have any questions, feel free to email Israel Golden (the person who wrote the
// code) at israelagolden@gmail.com. This is my first major JavaScript project so please
// forgive any inefficiencies in the code. With all that said, enjoy!
//
// Last updated: July 2022

///////////////////
////  Imports  ////
///////////////////

// In the pane above the code editor are the Imports to the script. There are 5 imports
// necessary to make this code run.
// 1. HUC_12_Data: This table is the result of processing values in ArcGIS and is more a
//    relic of my first go at making the app work. All it is used for now is populating
//    the values of the drop-down menus for counties and river basins and the HUC
//    seen on the map before a scenario has been run. It could probably be removed entirely
//    if you use F_HUC_Scores to do this instead (up to you!).
// 2. counties: This is a feature collection hosted by Earth Engine and contains county
//    data (including their extent). We filter it for NC counties and use it to determine
//    when a HUC unit intersects with a selected county.
// 3. F_HUC_Scores: This table contains values for each HUC where protected lands within
//    HUCs are excluded from summary values (the F stands for 'filtered'). All values are
//    in terms of unit per acre or percentage to reduce bias toward larger HUCs.
// 4. NF_HUC_Scores: The same as F_HUC_Scores except that protected lands are not excluded
//    (NF stands for 'no filter').
// 5. geometry: This is a dummy drawing for the geometry tool that allows the tool to run
//    when you haven't yet selected a geometry. It is essentially empty, but will be replaced
//    with values based on user-drawn geometry.

//////////////////////////////
////  Global Variables    ////
//////////////////////////////

// Global variables are variables created outside a function that can be used both
// within and outside of functions. Earth Engine runs on functions so ensuring that the
// right variables can be accessed by each function is critical to the success of
// the project.
var priority_number, NumberOfElementsAdded, HUC_12_Data2, SelectedSheds,
  CarbonWeight, PotCarbWeight, FlowWeight, NCNHPWeight, PDCWeight, PHWeight,
  ProAreaWeight, ResilienceWeight, SVIDistWeight, Area12Weight, Area32Weight,
  county1, county2, county3, county4, county5, county6, county7, county8, county9, county10,
  ChartPanel, aoi, HUC_Math, geometry;

////////////////////////////////////////////
////  Basic Map Visualization Settings  ////
////////////////////////////////////////////

// Map.setControlVisibility allows users to make decisions regarding aspects of the basic
// map visualization. The settings adjustments below add a scale to the map and remove the
// +/- zoom buttons that are the default Earth Engine setting for operating zooming in/out
Map.setControlVisibility({scaleControl: true, zoomControl: false});

// Next, we want to hide the drawing tools from the user - we'll supply them later when
// they can be trusted with the limited options we provide. To hide them, we first have to
// create a variable 'drawingTools' and then setShown to be false.
var drawingTools = Map.drawingTools();
drawingTools.setShown(false);

// When there are any drawn geometries on the map, they are removed after running the tool.
// This is helpful so that our map does not become cluttered with drawn geometries run after
// run.
while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}
// Finally, the code requires a geometry layer to run but we don't want it to have any actual
// value so we create a dummyGeometry. This is import number 5 from the previous section.
var dummyGeometry =
    ui.Map.GeometryLayer({geometries: null, name: 'geometry', color: '23cba7'});
drawingTools.layers().add(dummyGeometry);

// Map.centerObject centers whatever object is within the parentheses. In this case, we center
// HUC_12_Data because we want the map to be centered on our FeatureCollection. Once again,
// HUC_12_Data could probably be replaced with F_HUC_Scores.
Map.centerObject(HUC_12_Data);

// Another style choice, here we set the cursor to be a crosshair because it looks cool
Map.style().set({cursor: 'crosshair'});

// In the next few lines, we style and add the default HUCs to the map. These are the dark
// blue, clear HUCs that you see on the map before a scenario has been run in the tool.

// Here we choose the visualization parameters for the default HUC layer. The color is dark
// blue but - if you'd like to change it - just look up any 6-digit html color code.
// you must specify a fill color (in this case '00000000' is black) even though it is not
// visualized. By selecting a width, you make the interior of the HUCs clear.
var HUC_STYLE = {color: '26458d', fillColor: '00000000', width:1.5};
// Next, we apply 'HUC_STYLE' to the HUC_12_Data and call it 'originalHUCLayer.' Then we
// add it to the map using the Map.addLayer() function.
var originalHUCLayer = HUC_12_Data.style(HUC_STYLE);
Map.addLayer(originalHUCLayer);

///////////////////////////////////////
////  Explore HUC Attributes Tool  ////
///////////////////////////////////////

// The following section describes how the Explore HUC Attributes button/tool in the bottom
// right of the screen works.

// In the next line of code, we choose what color and fill color a selected HUC will be
// if clicked on when the explorer tools is running. I chose turquoise because I think it
// contrasts nicely with both the viridis color scheme and the dark-blue of the default
// HUC visualization.
var HIGHLIGHT_STYLE = {color: '81ecf1', fillColor: '81ecf1C0'};

// Here I provide a search distance for the tool. It will select the nearest HUC within 1
// meter of where it is clicked on the map. Might not be necessary, but it works!
var SEARCH_DISTANCE = 1;  // Meters.

// The function below creates a dictionary - a data type where one key and one value are
// matched together - for every HUC that is clicked on with the HUC Explorer Button.
function getProps(loc) {
  // !! Important !! All of the code contained between line 88 and line 180 is contained
  // within the getProps function! All of this occurs when a point on the map is clicked
  // while operating the Explore HUCs Button.
  // 'loc' is the blank dictionary to be filled with latitude and longitude values.
  loc = ee.Dictionary(loc);
  // 'point' is the latitude and longitude of the clicked location.
  var point = ee.Geometry.Point(loc.getNumber('lon'), loc.getNumber('lat'));
  // 'thisHUC' is the F_HUC_Scores feature collection filtered to just the location of the
  // clicked point on hte map (i.e., this is the selected HUC). In essence, it creates another
  // feature collection that only contains this one HUC (if this is confusing, don't sweat it!).
  var thisHUC = F_HUC_Scores.filterBounds(point.buffer(SEARCH_DISTANCE));
  // Having selected an individual HUC ('thisHUC') we then select the values to be reported
  // from its singular feature collection. It will have the same column names as F_HUC_Scores
  // so we select them based on what those columns are named and then provide them with more
  // intelligible descriptions for reporting with 'propertySelectors' and 'newProperties'
  // respectively.
  // !! It's very important to maintain the order of selected properties with new property
  // names - otherwise your properties will be mislabeled !!
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
    // next we map the function (i.e. apply it to) the the selected/renamed properties of
    // 'thisHUC.' In all honesty, I'm not quite sure what these next few lines do. I got them
    // from a StackExchange post with minimal explanation, but they seem critical so I left
    // them in. If you are more studied in JavaScript than I, feel free to annotate what they
    // do accordingly.
      .map(function(ft) {
            return ft.set('system:click_distance', point.distance(ft.geometry()));
        })
      .sort('system:click_distance').first();

  // Next we create another dictionary (ah yes, the dictionary again!) named props (short for
  // properties) where all of the information in 'thisHUCAttributes' (i.e., all of the renamed)
  // column names and associated values) is stored in the dictionary.
  var props = thisHUCAttributes.toDictionary();
  // Now we evaluate the attributes of props for reporting and style it such that each
  // property has its own line in the HUC Explorer read-out panel ('\n' creates a new line).
    props.evaluate(function(props) {
    // this adds the string 'Sub-watershed: " and then the value of Subwatershed
    // so that it is at the top of the list
    var str = "Sub-watershed: "  + props.Subwatershed + '\n';
    // next we deleted Subwatershed so it doesn't appear twice. We do this because
    // we want subwatershed to be the first thing in an otherwise alphabetized list.
      delete props.Subwatershed;
      // Otherwise it takes each of the keys in the dictionary and adds its properties after
      // ': ' and creates a new line for the next property.
      Object.keys(props).forEach(function(i) {
        str = str + i + ': ' + props[i] + '\n';
      });
      info.setValue(str);
    });

  // We need a number of things to happen (removing the previously highlighted HUC, removing
  // the previously selected HUC's properties from the Explore HUCs panel, highlighting
  // the newly selected HUC, and reporting its values) when we click on the Map. Each of
  // the things we need done also require functions. So we need a function that runs a series
  // of other functions when we click on the map. To achieve this we'll create a function
  // 'handleMapClick()' to do all of these things when we click on a HUC. By writing it below
  // we say to Earth Engine "run this function!." We'll describe which functions exist within
  // handleMapClick in the lines below before wrapping them all inside 'handleMapClick.'
  handleMapClick();
  // Functions within 'handleMapClick()':
    // 'updateOverlay()' updates the map overlay using the currently-selected HUC.
    function updateOverlay() {
      // var HIGHLIGHT_STYLE = {color: '81ecf1', fillColor: '81ecf1C0'};
      // overlay is simply the selected HUC highlighted in turquoise.
      var overlay = thisHUC.style(HIGHLIGHT_STYLE);
      // this sets the index value of where the highlighted layer will appear. I believe the
      // default HUC map occupies the 0 position in the index, so we're setting the highlighted
      // HUC to be at index position 1. If it is placed above 1, the HUC will not be cleared
      // upon selecting another HUC (i.e. you'll have 2 or more HUCs selected at a time) when
      // using the Explore HUCs button (not ideal!)
      Map.layers().set(1, ui.Map.Layer(overlay));
    }
    // 'clearResults()' Clears the set of selected points and resets the overlay and results
    // panel to their default states. Notice that it is specifically removing the layer at
    // index position 1 (i.e., the highlighted HUC).
    function clearResults() {
      Map.layers().remove(Map.layers().get(1));
    }

  // Finally, both of those functions are included in 'handleMapClick()' so that when it is
  // run, first results are cleared and then the overlay is updated with the newly highlighted
  // HUCs. The order here is also important!
  function handleMapClick() {
    clearResults();
    updateOverlay();
  }
}

// Now for our very first UI element: 'inspectbutton1' aka the Explore HUCs button!
// First give the button a label (i.e. what appears on the map), a position (bottom-left of
// the screen), and tell it what to do when it is clicked!
var inspectbutton1 = ui.Button({
  label:'Explore HUC attributes',
  style: {position: 'bottom-left'},
  onClick: function() {
    // Three things happen when this button is clicked:
    // 1. the inspectbutton1 itself is removed from the map
  Map.remove(inspectbutton1);
    // 2. the button is replaced by the summarypanel where values from the selected appear.
    //    It is blank at first and populates with values upon clicking.
  Map.add(summarypanel);
    // 3. the 'getProps()' function from lines 88-180 runs. As a reminder, the 'getProps()'
    //    function filters F_HUC_Scores by the location of the clicked point, selects and
    //    renames the column names and values of that feature collection, supplies them to
    //    the summarypanel, removes the previously selected/highlighted HUC layer (if it,
    //    exists), and highlights the selected HUC!
  Map.onClick(getProps);
  }
});
// Now we have to create the summary panel where the properties of selected HUCs can be printed
// Remember 'props' from line 130? This is where it gets visualized!
// first, create a ui panel and provide position and dimensions.
var summarypanel = ui.Panel({style: {position: 'bottom-left', width: '22.5rem', height: '10rem'}});
// next, create a label that will be added to the panel and tell the user what to do.
var info = ui.Label({value: 'Click on a feature', style: {whiteSpace: 'pre'}});
// third, create a button for the user to close the panel and return to the default map
var collapsebutton = ui.Button({
  label: 'Collapse HUC Summary',
  style: {position: 'bottom-left'},
  onClick: function() {
    // first, this function removes the highlighted HUC from the map
    Map.layers().remove(Map.layers().get(1));
    // next, it removes the summary panel upon which it exists (and also itself)
    Map.remove(summarypanel);
    // third, it adds inspectbutton1 back to its original position in case the user
    // wants to do more HUC exploration.
    Map.add(inspectbutton1);
  }
});
// finally, add the info label and the collapse button to the panel.
summarypanel.add(info).add(collapsebutton);
// Once again, this panel will only appear if the inspectbutton1 is clicked, therefore
// we only need to add inspectbutton1 to the map and the code we wrote will take care of
// all the rest!
Map.add(inspectbutton1);

///////////////////////////////////////////
////  GUI Construction + Functionality ////
///////////////////////////////////////////

/// * TITLE & DESCRIPTION * ///

// First, generate a main panel and add it to the map.
var panel = ui.Panel({style: {width:'25%'}});
// the 0 places the panel on the left side of the map
ui.root.insert(0, panel);
// Create the title for the tool
var intro = ui.Label('NC HUC-12 Conservation Prioritization Tool Beta',
  {fontWeight: 'bold', fontSize: '24px', margin: '10px 5px'});
// Create a description about what it is/what it does.
var subtitle = ui.Label('This tool takes ecosystem services datasets'+
  ' summarized  at the HUC-12 sub-watershed level and allows users'+
  ' to prioritize HUCs within their area of interest based on their conservation goals.', {});
// Add the title and description to the panel. Elements are placed on the panel in the order
// that they are added so be careful to always add them according to the sequence you imagine.
panel.add(intro).add(subtitle);

/// * INCLUDE/EXCLUDE ALREADY PROTECTED LANDS * ///

// After we've added the title and description, it's time to supply the user with their
// first binary decision: whether to include or exclude protected lands from HUC summaries.
// This is essentially a choice of which feature collection to use (F_HUC_Scores or
// NF_HUC_Scores).

// first, create some labels for the user interface.
var filterLabel = ui.Label('Include or Exclude Protected Areas from Prioritization',
  {fontWeight:'bold', fontSize: '18px', margin:'10px 5px'});
var filterDescription = ui.Label('Use the drop-down menu below to either include or exclude already-protected' +
 ' areas (e.g. National Parks, conservation easements) from prioritization calculations. Default excludes protected lands.');
// Use ui.Select to create a dropdown list of options. We'll include just two options and
// set the default value to be 'Exclude already protected lands.'
var filterChoice = ui.Select({
  items: ['Exclude already protected lands', 'Include already protected lands']
}).setValue('Exclude already protected lands');
// Now add these widgets to the map
panel.add(filterLabel).add(filterDescription).add(filterChoice);

// The conditional statement about which Feature Collection to pull data from
// based on this dropdown selection occurs within PrioritizerTool() on line XXX.

/// * AOI SELECTION * ///

// Now we'll give users their second choice: selection of an area of interest
// start with labels and another drop-down

// AOIChoiceIndex value is 8 because that is the index position whereafter
// additional widgets will be inserted based on AOI selection choice.
var AOIChoiceIndex = 8;

// Create labels and dropdown
var AOILabel = ui.Label('Choose your Area of Interest',
  {fontWeight:'bold', fontSize: '18px', margin:'10px 5px'});
var AOIDescription = ui.Label({value: 'Use the dropdown menu below to select your area of interest. ' +
  'Options include selection by county, river basin, user-defined geometry, or the entire state.'
});

// this function counts the number of elements added to the AOI panel and is
// crucial for being able to dynamically add dropdown menus for counties or
// river basins as they are selected.

function addAOIPanelElements(AOIPanelElements, AOIChoiceIndex) {
  for (var i = 0; i < AOIPanelElements.length; i++) {
    panel.insert(AOIChoiceIndex + i, AOIPanelElements[i]);
  }
  return AOIPanelElements.length;
}

// this function clears the AOI Panel based on the AOIChoiceIndex and the Number of
// Elements added.
function ClearAOIPanel(AOIChoiceIndex, NumberOfElementsAdded) {
  var allWidgets = panel.widgets();
  for(var i = AOIChoiceIndex; i < NumberOfElementsAdded + AOIChoiceIndex; i++){
    panel.remove(allWidgets.get(AOIChoiceIndex));
  }
}
// Create a dropdown that calculates the number of elements added based on the selection
var AOIChoice = ui.Select({items:
      ['County',
      'River Basin',
      'User-defined Geometry',
      'Entire State'],
  // on the selection of an option, the following function is performed where
  // the number of elements added are first cleared, then defined based on the choice.
  onChange: function(key) {
    // this is a function of AOIChoiceIndex (8) and the Number of Elements Added which
    // varies based on the selection.
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
  // Labels that mark/describe county drop downs
  var selectCOI = ui.Label({value:'Select counties of interest',
    style: {fontSize: '18px', fontWeight: 'bold'}});
  var CountyRules = ui.Label('Select at least one county to consider HUC-12 units within.');

  // Create a feature collection + list from the US Counties feature collection for NC
  var NC_Counties = counties.filter(ee.Filter.eq('STATEFP', '37'));
  var NC_County_List = NC_Counties.aggregate_array('NAME').distinct().sort();

  // Create a listener function that adds a new DD upon selection and
  // then unlistens to the last DD so that new DDs aren't added on every change
  function CountyDDListener() {
    // This just finds the last dd in the list
    CountyPanelElements[CountyPanelElements.length - 1].unlisten();
    // we subtract 2 because there are 2 labels and 100 because there are 100 counties
    if((basinPanelElements.length - 2) >= 100) {
      return;
    }
    var newDD = ui.Select({items: [],
        placeholder:'Choose a county', onChange: CountyDDListener}
      );
    NC_County_List.evaluate(function(HUC_12_Data){
      newDD.items().reset(HUC_12_Data)});
      // inserts at the end of the county panel elements (including drop downs)
    panel.insert(AOIChoiceIndex + CountyPanelElements.length, newDD);
    // push adds the newest dd to the list of all the elements
    CountyPanelElements.push(newDD);
    NumberOfElementsAdded++;
    print(CountyPanelElements.length);
  }

  // the initial DD, on change, the CountyDDListener
  var InitialCountyDD = ui.Select({items: [],
    placeholder: 'Choose a county', onChange: CountyDDListener});

  // this bit of code provides the dropdowns with the counties
  NC_County_List.evaluate(function(HUC_12_Data){
    InitialCountyDD.items().reset(HUC_12_Data)});

  // Taken together, these are the items that will be added to the panel if
  // 'County' is chosen as the way to select area of interest.
  var CountyPanelElements = [selectCOI, CountyRules, InitialCountyDD];

// AOI: River Basin Selection
// The river basin selection works the very same way the county selection does
// except that it pulls river basins from NC_Rivers_List instead of NC_County_List
  // First, create list of river bains - used to populate drop-down menu
  var NC_Rivers_List = HUC_12_Data.aggregate_array('DWQ_Basin').distinct().sort();

  // Empty drop down
  var SelectBasinOfInterest = ui.Label({value:'Select river basins of interest',
    style: {fontSize: '18px', fontWeight: 'bold'}});
  var BasinRules = ui.Label('Select at least one river Basin to consider HUC-12 units within.');

  function RiverDDListener() {
    basinPanelElements[basinPanelElements.length - 1].unlisten();
    // we subtract 2 because there are 2 labels and 17 river basins in NC
    if((basinPanelElements.length - 2) >= 17) {
      return;
    }
    var newDD = ui.Select({items: [],
        placeholder:'Choose a basin', onChange: RiverDDListener}
      );
    NC_Rivers_List.evaluate(function(HUC_12_Data){
      newDD.items().reset(HUC_12_Data)});
      // inserts at the end of the basin panel elements (including drop downs)
    panel.insert(AOIChoiceIndex + basinPanelElements.length, newDD);
    // push adds the newest dd to the list of all the elements
    basinPanelElements.push(newDD);
    NumberOfElementsAdded++;
  }

  var InitialBasinDD = ui.Select({items: [],
    placeholder: 'Choose a basin', onChange: RiverDDListener});
  NC_Rivers_List.evaluate(function(HUC_12_Data){
    InitialBasinDD.items().reset(HUC_12_Data)});
  // These are the widgets that will be added when 'River Basin' is selected
  var basinPanelElements = [SelectBasinOfInterest, BasinRules, InitialBasinDD];

/// AOI: USER-DEFINED GEOMETRY

  // Get the drawn geometry; it will define the reduction region.
  var aoi = drawingTools.layers().get(0).getEeObject();
  // Function to clear previously drawn geometry
  function clearGeometry() {
    var layers = drawingTools.layers();
    layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
  }
  // Function that first clears previous geometry, then allows user to draw rectangle
  function drawRectangle() {
    clearGeometry();
    drawingTools.setShape('rectangle');
    drawingTools.draw();
  }
  // Function that first clears previous geometry, then allows user to draw polygon
  function drawPolygon() {
    clearGeometry();
    drawingTools.setShape('polygon');
    drawingTools.draw();
  }
  // Function that stops drawing - to be selected when user has finished drawing
  function stopDrawing() {
    drawingTools.stop();
  }
  // Create a symbol variable to visually represent what each choice means
  var symbol = {
    rectangle: '⬛',
    polygon: '🔺',
    nodraw: '🙅️✏️'
  };
  // create a panel for all drawing-related instructions and widgets to live,
  // then define the widgets in the order they should appear.
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
  // the only element is the control panel!
  var geomPanelElements = [controlPanel];

// AOI: ENTIRE STATE
// Nothing needs to be added to the panel if entire state is selected as the
// region of interest because... well... it's the entire state (simple).

/// * WEIGHT SLIDER SECTION * ///
// Give this section a title and explain what it is for/how it works
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

// Create labels for each of the sliders so that the user knows which data they
// are weighting. Also supply each label with a hyperlink to the original data.
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

// Finally, add these to the control panel in the where the label comes before the slider
panel.add(SpecifyWeights).add(WeightExplanation).add(CarbLabel).add(WeightSlider)
  .add(PotCarbLabel).add(WeightSlider1).add(FlowLabel).add(WeightSlider2)
  .add(NCNHPLabel).add(WeightSlider3).add(PDCLabel).add(WeightSlider4).add(PHLabel)
  .add(WeightSlider5).add(ProAreaLabel).add(WeightSlider6).add(ResLabel).add(WeightSlider7)
  .add(SVIDLabel).add(WeightSlider8).add(Area12Label).add(WeightSlider9)
  .add(Area32Label).add(WeightSlider10);

/// * SELECT PRIORITY HUCS NUMBER * ///
// Next create the label for Priority HUCs + explanation and add them to the panel
var PriorityHUCsLabel = ui.Label('Select priority number',
{fontWeight:'bold', fontSize: '18px', margin:'10px 5px'});
var priorityHUCsValue = ui.Label('Upon running the scenario, the top-ranking HUCs based ' +
  'on your inputs will be added to a series of charts on the right side of the screen. ' +
  'To enhance legibility, select how many of the top HUCs you wish to include in the ' +
  'charts (e.g., the top 3, top 5, or top 100). These HUCs will also be outlined in ' +
  'purple on the map. To add labels to the top HUCs, check the "High performing ' +
  'HUC labels" checkbox in the "Layers" dropdown menu in the top right.');
// Priority HUCs widget
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

// This section is where all of the inputs from our user interface are accessed by
// the functions and generate the outputs we want. First, we must write a function that
// gets the user-input values and then we will write a function that prioritizes the
// HUCs based on those user-input values.

// First, 'GetCurrentValues()' simply gathers the values that were selected by the user
// in the GUI.

function GetCurrentValues() {
  priority_number = Number(HUCNumberbox.getValue());
  // If the user does not supply a priority number, the default is 3
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

// and now... the pièce de resistance: PrioritizerTool()

function PrioritizerTool()
{
  // First clear the map of anything that may be on it (e.g., geometries, default HUCs
  // , or HUC selections with the Exlpre HUC attributes tool)
  Map.clear();
  // Next, we'll have to remove any of the default Earth Engine Map settings we don't want
  Map.setControlVisibility({scaleControl: true, zoomControl: false});
  drawingTools.setShown(false);
  // Run the stopDrawing() function so that - if they forgot to click 'stop drawing',
  // which let's be honest they probably did - that decision will not haunt them
  // after having run a scenario.
  stopDrawing();
  // then we run the 'GetCurrentValues()' function to get the values from the user input.
  GetCurrentValues();

// We also need to re-create the Exlpore HUC Atributes tool... this should probably
// be generalized with inputs being loc and choosing a different overlay index to
// remove selected HUCs (in this case the layer removed is at index position 4
// instead of 1) ... otherwise it's the same. As such, I'm not going to annotate this
// code but I will point out where the 4 exists in place of the 1.
var SEARCH_DISTANCE = 1;  // Meters.
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
    // Here is where we set the highlighted huc at index position 4 instead of 1
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
    // once again, layer 4 (i.e. the highlighted HUC) is removed
    Map.layers().remove(Map.layers().get(4));
    Map.remove(summarypanel);
    Map.add(inspectbutton);
  }
});
summarypanel.add(info).add(collapsebutton);
Map.add(inspectbutton);
// End of repeated Explore HUC Attributes tool... if another programmer wanted to
// they could easily remove around 70 lines of code if they were able to more
// generalize the getProps function. Once again, inputs should be loc and the number.

/// * INCLUDE/EXCLUDE ALREADY PROTECTED LANDS * ///

// This next section of code links back to the input of the first user decision about
// whether or not to include/exclude protected lands around line 300. Basically, what
// this says is if the user chooses 'Exclude...' then the Feature Collection from
// which data is pulled is F_HUC_Scores. If they chose 'Include...' the Feature Collection
// is NF_HUC_Scores. If they choose neither, it will be F_HUC_Scores because the
// default is to exclude already protected lands. We define their choice as HUC_12_Data2
// because we want a generalized input for the rest of the function no matter what
// the user's decision is. As you will see, HUC_12_Data2 is used in the remainder of
// the function extensively.

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

// Much like the previous chunk of code, the 'SelectedSheds' is a generalized
// variable that depends upon which method/input the user decides to use to define
// their area of interest. The rest of PrioritizerTool() uses 'SelectedSheds' to
// generate all of the outputs the user desires.

  if (AOIChoice.getValue() == 'County'){
    // First create an empty array
    var SelectedCounties = [];
    // Find the number of counties that were added by the user
    for (var i=2; i < CountyPanelElements.length; i++){
      SelectedCounties.push(
        // get the values (i.e. names) of those counties to create a list of
        // values to populate the SelectedCounties array
          CountyPanelElements[i].getValue());
    }
    // Now filter the NC_Counties Feature Collection based on whether or not
    // the counties are included in the SelectedCounties array just generated
    var CountySelection = NC_Counties.filter(
      ee.Filter.inList('NAME', SelectedCounties)
    );
    // Finally, we arrive at SelectedSheds by filtering HUC_12_Data2 by the
    // geographic intersection of HUCs with selected counties.
    SelectedSheds = HUC_12_Data2.filterBounds(CountySelection);
  }

  // Next we move on to selecting by river basins.
  // This works very similarly to the county selection except that there is not
  // the extra step of filtering by geographic intersect because river basin (aka
  // DWQ_Basin) is already a column in our HUC feature collections.
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
  // Third, if they choose user-defined geometry the same filterbounds argument
  // used in the counties to find which HUCs intersect with selected counties is
  // used to find which HUCs intersect with the drawn geometry. These intersecting
  // HUCs are the SelectedSheds.
  else if (AOIChoice.getValue() == 'User-defined Geometry') {

    SelectedSheds = HUC_12_Data2.filterBounds(aoi);// so the issue is that it's not picking up a geometry value
    clearGeometry();
  }
  // Finally, if they choose the entire state, there is no geographic filter so we don't
  // need to apply one. SelectedSheds = HUC_12_Data2.
  else if (AOIChoice.getValue() == 'Entire State') {
// There's no filter, so it's just the whole state
    SelectedSheds = HUC_12_Data2;
  }
  // With the new feature collection containing only our HUCs of Interest (SelectedSheds)
  // We will create a function within the function to calculate weights and add their sum
  // to a new column called 'Weight' in a new FC called HUC_Math
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

  // Apply the weighted function to SelectedSheds to create the Weight column in the new FC
  // called HUC_Math.
  var HUC_Math = SelectedSheds.map(addField);

  // Now create yet another FC that only contains the highest performing HUCs by sorting
  // according to weight and then limiting it to the priority_number specified by user
  var highPriority = HUC_Math
    .sort('weight', false)
    .limit(priority_number);

//2. Visualization

  // Determine max and min for visualization
    // All HUCs
      var WeightMax = ee.Number(HUC_Math.aggregate_stats('weight').get('max'));
      // generally speaking, it's not great to move between server-side and client-side
      // objects... but unfortunately visualization parameters only take client-side
      // values so with the .getInfo() command, I convert the server-side value to
      // a client-side one that visualization parameters can handle.
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
    // this palette is the viridis color scheme
    var palette = ['#440154', '#433982', '#30678D', '#218F8B', '#36B677', '#8ED542', '#FDE725'];
    // add the newly ranked & visualized HUCs to the map
    Map.addLayer(NC_result, {palette: palette, min: visMin, max: visMax}, 'HUC prioritization');

  // Let's just add the HUCs as outlines so we can select them later...
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

  // Next, visualize the top-performing HUCs
    var result2 = ee.Image().byte();
    var high_pri = result2.paint({
      featureCollection: highPriority,
      color: 'weight',
      width: 2
    });
    var palette2 = ['ffff74','fcfc55','fcfc2e','ffff00'];
    Map.addLayer(high_pri, {palette: '8856a7', min: visMin2, max: visMax2}, 'High priority HUCs');
    Map.centerObject(HUC_Math);

  // Adding labels to high-scoring HUCs...
    var text = require('users/gena/packages:text');
    // scale text font relative to the current map scale
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
  // List of top HUCs
    var highPriorityList = highPriority
      .reduceColumns(ee.Reducer.toList(), ['NAME']).get('list');

  // Co benefit scores as table for HUCs within AOI sorted according to score
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
              // this syntax means ('VALUE|Subwatershed name')
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

// When the tool runs another panel will appear on the right with the charts and
// table we just described. In addition to these graphics, add some explanatory
// labels and descriptions.
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
// Insert the chart onto the Map, here index position 2 puts the chart on the right
// side of the map.
ui.root.insert(2, ChartPanel);

ChartPanel.add(ChartLabel).add(ChartDescription).add(CarbonChart)
.add(PotSeqChart).add(FlowChart).add(ResChart).add(BiodivChart).add(PHChart)
.add(PDCChart).add(SVIDChart).add(UNPRO_Chart).add(WLChart).add(NLChart)
.add(TableLabel).add(TableDescription).add(table);

// 5. Legend!
// create vizualization parameters
var viz = {min:visMin, max:visMax,
  palette:['#440154', '#433982', '#30678D', '#218F8B', '#36B677', '#8ED542', '#FDE725']};

// set position of panel
var legend = ui.Panel({
style: {
position: 'bottom-right',
padding: '4px 8px'
}
});

// Create legend title
var legendTitle = ui.Label({
value: 'HUC Ranking',
style: {
fontWeight: 'bold',
fontSize: '14px',
margin: '0 0 2px 0',
padding: '0'
}
});

// Add the title to the panel
legend.add(legendTitle);

// create the legend image
var lon = ee.Image.pixelLonLat().select('latitude');
var gradient = lon.multiply((viz.max-viz.min)/100.0).add(viz.min);
var legendImage = gradient.visualize(viz);

// create text on top of legend
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

// create thumbnail from the image
var thumbnail = ui.Thumbnail({
image: legendImage,
params: {bbox:'0,0,10,100', dimensions:'33x99'},
style: {padding: '1px', position: 'bottom-center'}
});

// add the thumbnail to the legend
legend.add(thumbnail);

// create text on top of legend
var legendpanel = ui.Panel({
widgets: [
ui.Label({
  value: 'Lowest priority',
  style: {
    fontSize: '10px'
  }
})

],
});

legend.add(legendpanel);

Map.add(legend);

// 6. Reset Button

// Finally, we need to be able to reset the map when we are done looking at the
// outputs. To do this we need to clear the map of its contents, clear any geometry
// in case the user decides to draw another shape before re-setting, set our
// desired visibility parameters, add the original default HUCs, and add the Explore
// HUC attributes button. Importantly, this 'reset button' will also need to
// remove itself and replace itself with the run scenario button so that
// the user can run another scenario. It will also need to add credits back to the
// panel because they are removed by the Run Scenario button.

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

// When the user hits Run Scenario it is important to remove the option for them
// to hit it again before having cleared the map. If the user were to run scenario
// twice without clearing the map, an additional panel with output tables
// would appear on the right and it would look not good. The solution to this?
// Remove the submit scenario button as an option and replace it with a reset button!
panel.remove(SubmitScenario);
panel.remove(credits);
// the reset button runs the reset() function described above.
var resetButton = ui.Button('Reset Map', reset);
panel.add(resetButton);
panel.add(credits);
}
