Ext.data.JsonP.Lumenize_OLAPCube({"tagname":"class","name":"Lumenize.OLAPCube","extends":null,"mixins":[],"alternateClassNames":[],"aliases":{},"singleton":false,"requires":[],"uses":[],"enum":null,"override":null,"inheritable":null,"inheritdoc":null,"meta":{},"private":null,"id":"class-Lumenize.OLAPCube","members":{"cfg":[{"name":"deriveFieldsOnInput","tagname":"cfg","owner":"Lumenize.OLAPCube","meta":{},"id":"cfg-deriveFieldsOnInput"},{"name":"deriveFieldsOnOutput","tagname":"cfg","owner":"Lumenize.OLAPCube","meta":{},"id":"cfg-deriveFieldsOnOutput"},{"name":"dimensions","tagname":"cfg","owner":"Lumenize.OLAPCube","meta":{},"id":"cfg-dimensions"},{"name":"keepFacts","tagname":"cfg","owner":"Lumenize.OLAPCube","meta":{},"id":"cfg-keepFacts"},{"name":"keepTotals","tagname":"cfg","owner":"Lumenize.OLAPCube","meta":{},"id":"cfg-keepTotals"},{"name":"metrics","tagname":"cfg","owner":"Lumenize.OLAPCube","meta":{},"id":"cfg-metrics"}],"property":[],"method":[{"name":"constructor","tagname":"method","owner":"Lumenize.OLAPCube","meta":{},"id":"method-constructor"},{"name":"addFacts","tagname":"method","owner":"Lumenize.OLAPCube","meta":{"chainable":true},"id":"method-addFacts"},{"name":"getCell","tagname":"method","owner":"Lumenize.OLAPCube","meta":{},"id":"method-getCell"},{"name":"getCells","tagname":"method","owner":"Lumenize.OLAPCube","meta":{},"id":"method-getCells"},{"name":"getDimensionValues","tagname":"method","owner":"Lumenize.OLAPCube","meta":{},"id":"method-getDimensionValues"},{"name":"getStateForSaving","tagname":"method","owner":"Lumenize.OLAPCube","meta":{},"id":"method-getStateForSaving"},{"name":"toString","tagname":"method","owner":"Lumenize.OLAPCube","meta":{},"id":"method-toString"}],"event":[],"css_var":[],"css_mixin":[]},"linenr":11,"files":[{"filename":"OLAPCube.coffee.js","href":"OLAPCube.coffee.html#Lumenize-OLAPCube"}],"html_meta":{},"statics":{"cfg":[],"property":[],"method":[{"name":"newFromSavedState","tagname":"method","owner":"Lumenize.OLAPCube","meta":{"static":true},"id":"static-method-newFromSavedState"}],"event":[],"css_var":[],"css_mixin":[]},"component":false,"superclasses":[],"subclasses":[],"mixedInto":[],"parentMixins":[],"html":"<div><pre class=\"hierarchy\"><h4>Files</h4><div class='dependency'><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube' target='_blank'>OLAPCube.coffee.js</a></div></pre><div class='doc-contents'><p><strong>An efficient, in-memory, incrementally-updateable, hierarchy-capable OLAP Cube implementation.</strong></p>\n\n<p><a href=\"http://en.wikipedia.org/wiki/OLAP_cube\">OLAP Cubes</a> are a powerful abstraction that makes it easier to do everything\nfrom simple group-by operations to more complex multi-dimensional and hierarchical analysis. This implementation has\nthe same conceptual ancestry as implementations found in business intelligence and OLAP database solutions. However,\nit is meant as a light weight alternative primarily targeting the goal of making it easier for developers to implement\ndesired analysis. It also supports serialization and incremental updating so it's ideally\nsuited for visualizations and analysis that are updated on a periodic or even continuous basis.</p>\n\n<h2>Features</h2>\n\n<ul>\n<li>In-memory</li>\n<li>Incrementally-updateable</li>\n<li>Serialize (<code>getStateForSaving()</code>) and deserialize (<code>newFromSavedState()</code>) to preserve aggregations between sessions</li>\n<li>Accepts simple JavaScript Objects as facts</li>\n<li>Storage and output as simple JavaScript Arrays of Objects</li>\n<li>Hierarchy (trees) derived from fact data assuming <a href=\"http://en.wikipedia.org/wiki/Materialized_path\">materialized path</a>\narray model commonly used with NoSQL databases</li>\n</ul>\n\n\n<h2>2D Example</h2>\n\n<p>Let's walk through a simple 2D example from facts to output. Let's say you have this set of facts:</p>\n\n<pre><code>facts = [\n  {ProjectHierarchy: [1, 2, 3], Priority: 1, Points: 10},\n  {ProjectHierarchy: [1, 2, 4], Priority: 2, Points: 5 },\n  {ProjectHierarchy: [5]      , Priority: 1, Points: 17},\n  {ProjectHierarchy: [1, 2]   , Priority: 1, Points: 3 },\n]\n</code></pre>\n\n<p>The ProjectHierarchy field models its hierarchy (tree) as an array containing a\n<a href=\"http://en.wikipedia.org/wiki/Materialized_path\">materialized path</a>. The first fact is \"in\" Project 3 whose parent is\nProject 2, whose parent is Project 1. The second fact is \"in\" Project 4 whose parent is Project 2 which still has\nProject 1 as its parent. Project 5 is another root Project like Project 1; and the fourth fact is \"in\" Project 2.\nSo the first fact will roll-up the tree and be aggregated against [1], and [1, 2] as well as [1, 2, 3]. Root Project 1\nwill get the data from all but the third fact which will get aggregated against root Project 5.</p>\n\n<p>We specify the ProjectHierarchy field as a dimension of type 'hierarchy' and the Priorty field as a simple value dimension.</p>\n\n<pre><code>dimensions = [\n  {field: \"ProjectHierarchy\", type: 'hierarchy'},\n  {field: \"Priority\"}\n]\n</code></pre>\n\n<p>This will create a 2D \"cube\" where each unique value for ProjectHierarchy and Priority defines a different cell.\nNote, this happens to be a 2D \"cube\" (more commonly referred to as a <a href=\"http://en.wikipedia.org/wiki/Pivot_Table\">pivot table</a>),\nbut you can also have a 1D cube (a simple group-by), a 3D cube, or even an n-dimensional hypercube where n is greater than 3.</p>\n\n<p>You can specify any number of metrics to be calculated for each cell in the cube.</p>\n\n<pre><code>metrics = [\n  {field: \"Points\", f: \"sum\", as: \"Scope\"}\n]\n</code></pre>\n\n<p>You can use any of the aggregation functions found in <a href=\"#!/api/Lumenize.functions\" rel=\"Lumenize.functions\" class=\"docClass\">Lumenize.functions</a> except <code>count</code>. The count metric is\nautomatically tracked for each cell. The <code>as</code> specification is optional unless you provide a custom function. If missing,\nit will build the name of the resulting metric from the field name and the function. So without the <code>as: \"Scope\"</code> the\nsecond metric in the example above would have been named \"Points_sum\".</p>\n\n<p>You can also use custom functions in the form of <code>f(values) -&gt; return &lt;some function of values&gt;</code>.</p>\n\n<p>Next, we build the config parameter from our dimension and metrics specifications.</p>\n\n<pre><code>config = {dimensions, metrics}\n</code></pre>\n\n<p>Hierarchy dimensions automatically roll up but you can also tell it to keep all totals by setting config.keepTotals to\ntrue. The totals are then kept in the cells where one or more of the dimension values are set to <code>null</code>. Note, you\ncan also set keepTotals for individual dimension and should probably use that if you have more than a few dimensions\nbut we're going to set it globally here:</p>\n\n<pre><code>config.keepTotals = true\n</code></pre>\n\n<p>Now, let's create the cube.</p>\n\n<pre><code>{OLAPCube} = require('../')\ncube = new OLAPCube(config, facts)\n</code></pre>\n\n<p><code>getCell()</code> allows you to extract a single cell. The \"total\" cell for all facts where Priority = 1 can be found as follows:</p>\n\n<pre><code>console.log(cube.getCell({Priority: 1}))\n# { ProjectHierarchy: null, Priority: 1, _count: 3, Scope: 30 }\n</code></pre>\n\n<p>Notice how the ProjectHierarchy field value is <code>null</code>. This is because it is a total cell for Priority dimension\nfor all ProjectHierarchy values. Think of <code>null</code> values in this context as wildcards.</p>\n\n<p>Similarly, we can get the total for all descendants of ProjectHierarchy = [1] regarless of Priority as follows:</p>\n\n<pre><code>console.log(cube.getCell({ProjectHierarchy: [1]}))\n# { ProjectHierarchy: [ 1 ], Priority: null, _count: 3, Scope: 18 }\n</code></pre>\n\n<p><code>getCell()</code> uses the cellIndex so it's very efficient. Using <code>getCell()</code> and <code>getDimensionValues()</code>, you can iterate\nover a slice of the OLAPCube. It is usually preferable to access the cells in place like this rather than the\ntraditional OLAP approach of extracting a slice for processing.</p>\n\n<pre><code>rowValues = cube.getDimensionValues('ProjectHierarchy')\ncolumnValues = cube.getDimensionValues('Priority')\ns = OLAPCube._padToWidth('', 7) + ' | '\ns += ((OLAPCube._padToWidth(JSON.stringify(c), 7) for c in columnValues).join(' | '))\ns += ' | '\nconsole.log(s)\nfor r in rowValues\n  s = OLAPCube._padToWidth(JSON.stringify(r), 7) + ' | '\n  for c in columnValues\n    cell = cube.getCell({ProjectHierarchy: r, Priority: c})\n    if cell?\n      cellString = JSON.stringify(cell._count)\n    else\n      cellString = ''\n    s += OLAPCube._padToWidth(cellString, 7) + ' | '\n  console.log(s)\n#         |    null |       1 |       2 |\n#    null |       4 |       3 |       1 |\n#     [1] |       3 |       2 |       1 |\n#   [1,2] |       3 |       2 |       1 |\n# [1,2,3] |       1 |       1 |         |\n# [1,2,4] |       1 |         |       1 |\n#     [5] |       1 |       1 |         |\n</code></pre>\n\n<p>Or you can just call <code>toString()</code> method which extracts a 2D slice for tabular display. Both approachs will work on\ncubes of any number of dimensions two or greater. The manual example above extracted the <code>count</code> metric. We'll tell\nthe example below to extract the <code>Scope</code> metric.</p>\n\n<pre><code>console.log(cube.toString('ProjectHierarchy', 'Priority', 'Scope'))\n# |        || Total |     1     2|\n# |==============================|\n# |Total   ||    35 |    30     5|\n# |------------------------------|\n# |[1]     ||    18 |    13     5|\n# |[1,2]   ||    18 |    13     5|\n# |[1,2,3] ||    10 |    10      |\n# |[1,2,4] ||     5 |           5|\n# |[5]     ||    17 |    17      |\n</code></pre>\n\n<h2>Dimension types</h2>\n\n<p>The following dimension types are supported:</p>\n\n<ol>\n<li>Single value\n\n<ul>\n<li>Number</li>\n<li>String</li>\n<li>Does not work:\n\n<ul>\n<li>Boolean - known to fail</li>\n<li>Object - may sorta work but sort-order at least is not obvious</li>\n<li>Date - not tested but may actually work</li>\n</ul>\n</li>\n</ul>\n</li>\n<li>Arrays as materialized path for hierarchical (tree) data</li>\n<li>Non-hierarchical Arrays (\"tags\")</li>\n</ol>\n\n\n<p>There is no need to tell the OLAPCube what type to use with the exception of #2. In that case, add <code>type: 'hierarchy'</code>\nto the dimensions row like this:</p>\n\n<pre><code>dimensions = [\n  {field: 'hierarchicalDimensionField', type: 'hierarchy'} #, ...\n]\n</code></pre>\n\n<h2>Hierarchical (tree) data</h2>\n\n<p>This OLAP Cube implementation assumes your hierarchies (trees) are modeled as a\n<a href=\"http://en.wikipedia.org/wiki/Materialized_path\">materialized path</a> array. This approach is commonly used with NoSQL databases like\n<a href=\"http://probablyprogramming.com/2008/07/04/storing-hierarchical-data-in-couchdb\">CouchDB</a> and\n<a href=\"http://docs.mongodb.org/manual/tutorial/model-tree-structures/\">MongoDB (combining materialized path and array of ancestors)</a>\nand even SQL databases supporting array types like <a href=\"http://justcramer.com/2012/04/08/using-arrays-as-materialized-paths-in-postgres/\">Postgres</a>.</p>\n\n<p>This approach differs from the traditional OLAP/MDX fixed/named level hierarchy approach. In that approach, you assume\nthat the number of levels in the hierarchy are fixed. Also, each level in the hierarchy is either represented by a different\ncolumn (clothing example --> level 0: SEX column - mens vs womens; level 1: TYPE column - pants vs shorts vs shirts; etc.) or\npredetermined ranges of values in a single field (date example --> level 0: year; level 1: quarter; level 2: month; etc.)</p>\n\n<p>However, the approach used by this OLAPCube implementaion is the more general case, because it can easily simulate\nfixed/named level hierachies whereas the reverse is not true. In the clothing example above, you would simply key\nyour dimension off of a derived field that was a combination of the SEX and TYPE columns (e.g. ['mens', 'pants'])</p>\n\n<h2>Date/Time hierarchies</h2>\n\n<p>Lumenize is designed to work well with the tzTime library. Here is an example of taking a bunch of ISOString data\nand doing timezone precise hierarchical roll up based upon the date segments (year, month).</p>\n\n<pre><code>data = [\n  {date: '2011-12-31T12:34:56.789Z', value: 10},\n  {date: '2012-01-05T12:34:56.789Z', value: 20},\n  {date: '2012-01-15T12:34:56.789Z', value: 30},\n  {date: '2012-02-01T00:00:01.000Z', value: 40},\n  {date: '2012-02-15T12:34:56.789Z', value: 50},\n]\n\n{Time} = require('../')\n\nconfig =\n  deriveFieldsOnInput: [{\n    field: 'dateSegments',\n    f: (row) -&gt;\n      return new Time(row.date, Time.MONTH, 'America/New_York').getSegmentsAsArray()\n  }]\n  metrics: [{field: 'value', f: 'sum'}]\n  dimensions: [{field: 'dateSegments', type: 'hierarchy'}]\n\ncube = new OLAPCube(config, data)\nconsole.log(cube.toString(undefined, undefined, 'value_sum'))\n# | dateSegments | value_sum |\n# |==========================|\n# | [2011]       |        10 |\n# | [2011,12]    |        10 |\n# | [2012]       |       140 |\n# | [2012,1]     |        90 |\n# | [2012,2]     |        50 |\n</code></pre>\n\n<p>Notice how '2012-02-01T00:00:01.000Z' got bucketed in January because the calculation was done in timezone\n'America/New_York'.</p>\n\n<h2>Non-hierarchical Array fields</h2>\n\n<p>If you don't specify type: 'hierarchy' and the OLAPCube sees a field whose value is an Array in a dimension field, the\ndata in that fact would get aggregated against each element in the Array. So a non-hierarchical Array field like\n['x', 'y', 'z'] would get aggregated against 'x', 'y', and 'z' rather than ['x'], ['x', 'y'], and ['x','y','z]. This\nfunctionality is useful for  accomplishing analytics on tags, but it can be used in other powerful ways. For instance\nlet's say you have a list of events:</p>\n\n<pre><code>events = [\n  {name: 'Renaissance Festival', activeMonths: ['September', 'October']},\n  {name: 'Concert Series', activeMonths: ['July', 'August', 'September']},\n  {name: 'Fall Festival', activeMonths: ['September']}\n]\n</code></pre>\n\n<p>You could figure out the number of events active in each month by specifying \"activeMonths\" as a dimension.\n<a href=\"#!/api/Lumenize.TimeInStateCalculator\" rel=\"Lumenize.TimeInStateCalculator\" class=\"docClass\">Lumenize.TimeInStateCalculator</a> (and other calculators in Lumenize) use this technique.</p>\n</div><div class='members'><div class='members-section'><div class='definedBy'>Defined By</div><h3 class='members-title icon-cfg'>Config options</h3><div class='subsection'><div id='cfg-deriveFieldsOnInput' class='member first-child not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-cfg-deriveFieldsOnInput' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-cfg-deriveFieldsOnInput' class='name not-expandable'>deriveFieldsOnInput</a><span> : Object[]</span></div><div class='description'><div class='short'><p>An Array of Maps in the form <code>{field:'myField', f:(fact)-&gt;...}</code></p>\n</div><div class='long'><p>An Array of Maps in the form <code>{field:'myField', f:(fact)-&gt;...}</code></p>\n</div></div></div><div id='cfg-deriveFieldsOnOutput' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-cfg-deriveFieldsOnOutput' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-cfg-deriveFieldsOnOutput' class='name expandable'>deriveFieldsOnOutput</a><span> : Object[]</span></div><div class='description'><div class='short'>same format as deriveFieldsOnInput, except the callback is in the form f(row)\n  This is only called for dirty rows th...</div><div class='long'><p>same format as deriveFieldsOnInput, except the callback is in the form <code>f(row)</code>\n  This is only called for dirty rows that were effected by the latest round of addFacts. It's more efficient to calculate things\n  like standard deviation and percentile coverage here than in config.metrics. You just have to remember to include the dependencies\n  in config.metrics. Standard deviation depends upon <code>sum</code> and <code>sumSquares</code>. Percentile coverage depends upon <code>values</code>.\n  In fact, if you are going to capture values anyway, all of the functions are most efficiently calculated here.\n  Maybe some day, I'll write the code to analyze your metrics and move them out to here if it improves efficiency.</p>\n</div></div></div><div id='cfg-dimensions' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-cfg-dimensions' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-cfg-dimensions' class='name expandable'>dimensions</a><span> : Object[]</span></div><div class='description'><div class='short'>Array which specifies the fields to use as dimension fields. ...</div><div class='long'><p>Array which specifies the fields to use as dimension fields. If the field contains a\n  hierarchy array, say so in the row, (e.g. <code>{field: 'SomeFieldName', type: 'hierarchy'}</code>). Any array values that it\n  finds in the supplied facts will be assumed to be tags rather than a hierarchy specification unless <code>type: 'hierarchy'</code>\n  is specified.</p>\n\n<p>  For example, let's say you have a set of facts that look like this:</p>\n\n<pre><code>fact = {\n  dimensionField: 'a',\n  hierarchicalDimensionField: ['1','2','3'],\n  tagDimensionField: ['x', 'y', 'z'],\n  valueField: 10\n}\n</code></pre>\n\n<p>  Then a set of dimensions like this makes sense.</p>\n\n<pre><code>config.dimensions = [\n  {field: 'dimensionField'},\n  {field: 'hierarchicalDimensionField', type: 'hierarchy'},\n  {field: 'tagDimensionField', keepTotals: true}\n]\n</code></pre>\n\n<p>  Notice how a keepTotals can be set for an individual dimension. This is preferable to setting it for the entire\n  cube in cases where you don't want totals in all dimensions.</p>\n</div></div></div><div id='cfg-keepFacts' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-cfg-keepFacts' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-cfg-keepFacts' class='name expandable'>keepFacts</a><span> : Boolean</span></div><div class='description'><div class='short'>Setting this will cause the OLAPCube to keep track of the facts that contributed to\n  the metrics for each cell by ad...</div><div class='long'><p>Setting this will cause the OLAPCube to keep track of the facts that contributed to\n  the metrics for each cell by adding an automatic 'facts' metric. Note, facts are restored after deserialization\n  as you would expect, but they are no longer tied to the original facts. This feature, especially after a restore\n  can eat up memory.</p>\n<p>Defaults to: <code>false</code></p></div></div></div><div id='cfg-keepTotals' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-cfg-keepTotals' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-cfg-keepTotals' class='name expandable'>keepTotals</a><span> : Boolean</span></div><div class='description'><div class='short'>Setting this will add an additional total row (indicated with field: null) along\n  all dimensions. ...</div><div class='long'><p>Setting this will add an additional total row (indicated with field: null) along\n  all dimensions. This setting can have an impact on the memory usage and performance of the OLAPCube so\n  if things are tight, only use it if you really need it. If you don't need it for all dimension, you can specify\n  keepTotals for individual dimensions.</p>\n<p>Defaults to: <code>false</code></p></div></div></div><div id='cfg-metrics' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-cfg-metrics' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-cfg-metrics' class='name expandable'>metrics</a><span> : Object[]</span></div><div class='description'><div class='short'>Array which specifies the metrics to calculate for each cell in the cube. ...</div><div class='long'><p>Array which specifies the metrics to calculate for each cell in the cube.</p>\n\n<p>  Example:</p>\n\n<pre><code>config = {}\nconfig.metrics = [\n  {field: 'field3'},                                      # defaults to metrics: ['sum']\n  {field: 'field4', metrics: [\n    {f: 'sum'},                                           # will add a metric named field4_sum\n    {as: 'median4', f: 'p50'},                            # renamed p50 to median4 from default of field4_p50\n    {as: 'myCount', f: (values) -&gt; return values.length}  # user-supplied function\n  ]}\n]\n</code></pre>\n\n<p>  If you specify a field without any metrics, it will assume you want the sum but it will not automatically\n  add the sum metric to fields with a metrics specification. User-supplied aggregation functions are also supported as\n  shown in the 'myCount' metric above.</p>\n\n<p>  Note, if the metric has dependencies (e.g. average depends upon count and sum) it will automatically add those to\n  your metric definition. If you've already added a dependency but put it under a different \"as\", it's not smart\n  enough to sense that and it will add it again. Either live with the slight inefficiency and duplication or leave\n  dependency metrics named their default by not providing an \"as\" field.</p>\n<p>Defaults to: <code>[]</code></p></div></div></div></div></div><div class='members-section'><h3 class='members-title icon-method'>Methods</h3><div class='subsection'><div class='definedBy'>Defined By</div><h4 class='members-subtitle'>Instance Methods</h3><div id='method-constructor' class='member first-child not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-constructor' target='_blank' class='view-source'>view source</a></div><strong class='new-keyword'>new</strong><a href='#!/api/Lumenize.OLAPCube-method-constructor' class='name expandable'>Lumenize.OLAPCube</a>( <span class='pre'>config, [facts]</span> ) : <a href=\"#!/api/Lumenize.OLAPCube\" rel=\"Lumenize.OLAPCube\" class=\"docClass\">Lumenize.OLAPCube</a></div><div class='description'><div class='short'> ...</div><div class='long'>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>config</span> : Object<div class='sub-desc'><p>See Config options for details. DO NOT change the config settings after the OLAP class is instantiated.</p>\n</div></li><li><span class='pre'>facts</span> : Object[] (optional)<div class='sub-desc'><p>Optional parameter allowing the population of the OLAPCube with an intitial set of facts\n  upon instantiation. Use addFacts() to add facts after instantiation.</p>\n</div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'><a href=\"#!/api/Lumenize.OLAPCube\" rel=\"Lumenize.OLAPCube\" class=\"docClass\">Lumenize.OLAPCube</a></span><div class='sub-desc'>\n</div></li></ul></div></div></div><div id='method-addFacts' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-addFacts' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-method-addFacts' class='name expandable'>addFacts</a>( <span class='pre'>facts</span> ) : <a href=\"#!/api/Lumenize.OLAPCube\" rel=\"Lumenize.OLAPCube\" class=\"docClass\">Lumenize.OLAPCube</a><strong class='chainable signature' >chainable</strong></div><div class='description'><div class='short'>Adds facts to the OLAPCube. ...</div><div class='long'><p>Adds facts to the OLAPCube.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>facts</span> : Object[]<div class='sub-desc'><p>An Array of facts to be aggregated into OLAPCube. Each fact is a Map where the keys are the field names\n  and the values are the field values (e.g. <code>{field1: 'a', field2: 5}</code>).</p>\n</div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'><a href=\"#!/api/Lumenize.OLAPCube\" rel=\"Lumenize.OLAPCube\" class=\"docClass\">Lumenize.OLAPCube</a></span><div class='sub-desc'><p>this</p>\n</div></li></ul></div></div></div><div id='method-getCell' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-getCell' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-method-getCell' class='name expandable'>getCell</a>( <span class='pre'>[filter]</span> ) : Object[]</div><div class='description'><div class='short'>Returns the single cell matching the supplied filter. ...</div><div class='long'><p>Returns the single cell matching the supplied filter. Iterating over the unique values for the dimensions of\n  interest, you can incrementally retrieve a slice or dice using this method. Since <code>getCell()</code> always uses an index,\n  in most cases, this is better than using <code>getCells()</code> to prefetch a slice or dice.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>filter</span> : Object (optional)<div class='sub-desc'><p>Specifies the constraints for the returned cell in the form of <code>{field1: value1, field2: value2}.\n  Any fields that are specified in config.dimensions that are missing from the filter are automatically filled in\n  with null. Calling</code>getCell()<code>with no parameter or</code>{}` will return the total of all dimensions (if @config.keepTotals=true).</p>\n<p>Defaults to: <code>{}</code></p></div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'>Object[]</span><div class='sub-desc'><p>Returns the cell that match the supplied filter</p>\n</div></li></ul></div></div></div><div id='method-getCells' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-getCells' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-method-getCells' class='name expandable'>getCells</a>( <span class='pre'>[filterObject]</span> ) : Object[]</div><div class='description'><div class='short'>Returns a subset of the cells that match the supplied filter. ...</div><div class='long'><p>Returns a subset of the cells that match the supplied filter. You can perform slice and dice operations using\n  this. If you have criteria for all of the dimensions, you are better off using <code>getCell()</code>. Most times, it's\n  better to iterate over the unique values for the dimensions of interest using <code>getCell()</code> in place of slice or\n  dice operations.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>filterObject</span> : Object (optional)<div class='sub-desc'><p>Specifies the constraints that the returned cells must match in the form of\n  <code>{field1: value1, field2: value2}</code>. If this parameter is missing, the internal cells array is returned.</p>\n</div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'>Object[]</span><div class='sub-desc'><p>Returns the cells that match the supplied filter</p>\n</div></li></ul></div></div></div><div id='method-getDimensionValues' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-getDimensionValues' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-method-getDimensionValues' class='name expandable'>getDimensionValues</a>( <span class='pre'>field, [descending]</span> )</div><div class='description'><div class='short'>Returns the unique values for the specified dimension in sort order. ...</div><div class='long'><p>Returns the unique values for the specified dimension in sort order.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>field</span> : String<div class='sub-desc'><p>The field whose values you want</p>\n</div></li><li><span class='pre'>descending</span> : Boolean (optional)<div class='sub-desc'><p>Set to true if you want them in reverse order</p>\n<p>Defaults to: <code>false</code></p></div></li></ul></div></div></div><div id='method-getStateForSaving' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-getStateForSaving' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-method-getStateForSaving' class='name expandable'>getStateForSaving</a>( <span class='pre'>[meta]</span> ) : Object</div><div class='description'><div class='short'>Enables saving the state of an OLAPCube. ...</div><div class='long'><p>Enables saving the state of an OLAPCube.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>meta</span> : Object (optional)<div class='sub-desc'><p>An optional parameter that will be added to the serialized output and added to the meta field\n  within the deserialized OLAPCube</p>\n</div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'>Object</span><div class='sub-desc'><p>Returns an Ojbect representing the state of the OLAPCube. This Object is suitable for saving to\n  to an object store. Use the static method <code>newFromSavedState()</code> with this Object as the parameter to reconstitute the OLAPCube.</p>\n\n<pre><code>facts = [\n  {ProjectHierarchy: [1, 2, 3], Priority: 1},\n  {ProjectHierarchy: [1, 2, 4], Priority: 2},\n  {ProjectHierarchy: [5]      , Priority: 1},\n  {ProjectHierarchy: [1, 2]   , Priority: 1},\n]\n\ndimensions = [\n  {field: \"ProjectHierarchy\", type: 'hierarchy'},\n  {field: \"Priority\"}\n]\n\nconfig = {dimensions, metrics: []}\nconfig.keepTotals = true\n\noriginalCube = new OLAPCube(config, facts)\n\ndateString = '2012-12-27T12:34:56.789Z'\nsavedState = originalCube.getStateForSaving({upToDate: dateString})\nrestoredCube = OLAPCube.newFromSavedState(savedState)\n\nnewFacts = [\n  {ProjectHierarchy: [5], Priority: 3},\n  {ProjectHierarchy: [1, 2, 4], Priority: 1}\n]\noriginalCube.addFacts(newFacts)\nrestoredCube.addFacts(newFacts)\n\nconsole.log(restoredCube.toString() == originalCube.toString())\n# true\n\nconsole.log(restoredCube.meta.upToDate)\n# 2012-12-27T12:34:56.789Z\n</code></pre>\n</div></li></ul></div></div></div><div id='method-toString' class='member  not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-method-toString' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-method-toString' class='name expandable'>toString</a>( <span class='pre'>[rows], [columns], [metric]</span> ) : String</div><div class='description'><div class='short'>Produces a printable table with the first dimension as the rows, the second dimension as the columns, and the count\n ...</div><div class='long'><p>Produces a printable table with the first dimension as the rows, the second dimension as the columns, and the count\n  as the values in the table.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>rows</span> : String (optional)<div class='sub-desc'>\n<p>Defaults to: <code>&lt;first dimension&gt;</code></p></div></li><li><span class='pre'>columns</span> : String (optional)<div class='sub-desc'>\n<p>Defaults to: <code>&lt;second dimension&gt;</code></p></div></li><li><span class='pre'>metric</span> : String (optional)<div class='sub-desc'>\n<p>Defaults to: <code>'count'</code></p></div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'>String</span><div class='sub-desc'><p>A string which will render as a table when written to the console.</p>\n</div></li></ul></div></div></div></div><div class='subsection'><div class='definedBy'>Defined By</div><h4 class='members-subtitle'>Static Methods</h3><div id='static-method-newFromSavedState' class='member first-child not-inherited'><a href='#' class='side expandable'><span>&nbsp;</span></a><div class='title'><div class='meta'><span class='defined-in' rel='Lumenize.OLAPCube'>Lumenize.OLAPCube</span><br/><a href='source/OLAPCube.coffee.html#Lumenize-OLAPCube-static-method-newFromSavedState' target='_blank' class='view-source'>view source</a></div><a href='#!/api/Lumenize.OLAPCube-static-method-newFromSavedState' class='name expandable'>newFromSavedState</a>( <span class='pre'>p</span> ) : OLAPCube<strong class='static signature' >static</strong></div><div class='description'><div class='short'>Deserializes a previously stringified OLAPCube and returns a new OLAPCube. ...</div><div class='long'><p>Deserializes a previously stringified OLAPCube and returns a new OLAPCube.</p>\n\n<p>  See <code>getStateForSaving()</code> documentation for a detailed example.</p>\n\n<p>  Note, if you have specified config.keepFacts = true, the values for the facts will be restored, however, they\n  will no longer be references to the original facts. For this reason, it's usually better to include a <code>values</code> or\n  <code>uniqueValues</code> metric on some ID field if you want fact drill-down support to survive a save and restore.</p>\n<h3 class=\"pa\">Parameters</h3><ul><li><span class='pre'>p</span> : String/Object<div class='sub-desc'><p>A String or Object from a previously saved OLAPCube state</p>\n</div></li></ul><h3 class='pa'>Returns</h3><ul><li><span class='pre'>OLAPCube</span><div class='sub-desc'>\n</div></li></ul></div></div></div></div></div></div></div>"});