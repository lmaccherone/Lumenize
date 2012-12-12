{ChartTime, groupBy, groupByAt, aggregate, aggregateAt, percentileCreator} = require('../')

exports.aggregateTest =

#  testFail: (test) ->
#    test.ok(false)
#    test.done()

  testPercentile: (test) ->
  
    a = [15, 20, 35, 40, 50]
    a2 = [3, 5]
    
    test.equal(percentileCreator(50)(a2), 4)
    f = percentileCreator(40)
    test.equal(f(a), 29)
    test.ok(Math.abs(percentileCreator(90)(a) - 46) < 0.00001)
    test.ok(Math.abs(percentileCreator(99)(a) - 49.6) < 0.00001)
    test.ok(Math.abs(percentileCreator(99.9)(a) - 49.96) < 0.00001)
    test.ok(Math.abs(percentileCreator(50)(a) - 35) < 0.00001)
    test.ok(Math.abs(percentileCreator(100)(a) - 50) < 0.00001)
    test.ok(Math.abs(percentileCreator(0)(a) - 15) < 0.00001)
        
    test.done()
    
  testGroupBy: (test) ->    
    list = [
      { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
      { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
      { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
    ]
    
    spec = {
      groupBy: 'KanbanState',
      aggregationSpec: [
        {field: 'ObjectID', f: 'count'}
        {as: 'Drill-down', field:'ObjectID', f:'push'}
        {field: 'PlanEstimate', f: 'sum'}
        {as: 'mySum', field: 'PlanEstimate', f: (values) ->
          temp = 0
          for v in values
            temp += v
          return temp
        }
      ]
    }
      
    expected = [
      { 'ObjectID_count': 1, 'Drill-down': [ '1' ], 'PlanEstimate_sum': 5, mySum: 5, 'KanbanState': 'In progress'},
      { 'ObjectID_count': 2, 'Drill-down': [ '2', '3' ], 'PlanEstimate_sum': 8, mySum: 8, 'KanbanState': 'Ready to pull' } 
    ]
    
    a = groupBy(list, spec)
    
    test.deepEqual(a, expected)
    
    test.done()
    
  testGroupByAt: (test) ->    
    list1 = [
      { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
      { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
      { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 12 }
    ]
    
    list2 = [
      { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
      { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 5 },
      { ObjectID: '4', KanbanState: 'In test', PlanEstimate: 5, TaskRemainingTotal: 12 }
    ]
    
    atArray = [list1, list2]
    
    spec = {
      groupBy: 'KanbanState',
      uniqueValues: ['Ready to pull', 'In progress'] # 'In test' intentionally missing
      aggregationSpec: [
        {field: 'ObjectID', f: 'count'}
      ]
    }
      
    expected = [ 
      [
        { 'ObjectID_count': 2, KanbanState: 'Ready to pull' },
        { 'ObjectID_count': 1, KanbanState: 'In progress' },
        { 'ObjectID_count': 0, KanbanState: 'In test' } 
      ],
      [ 
        { 'ObjectID_count': 1, KanbanState: 'Ready to pull' },
        { 'ObjectID_count': 1, KanbanState: 'In progress' },
        { 'ObjectID_count': 1, KanbanState: 'In test' } 
      ] 
    ]
    
    a = groupByAt(atArray, spec)
    
    test.deepEqual(a, expected)
    
    test.done()
    
  testAggregate: (test) ->    
    list = [
      { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 22 },
      { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 4 },
      { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 13 }
    ]
    
    aggregationSpec = [
      {field: 'KanbanState', f: 'min'}
      {field: 'PlanEstimate', f:'min'}
      {field: 'PlanEstimate', f:'max'}
      {field: 'TaskRemainingTotal', f: 'variance'}
      {field: 'TaskRemainingTotal', f: 'standardDeviation'}
    ]
      
    expected = { 
      'KanbanState_min': 'In progress',
      'PlanEstimate_min': 3,
      'PlanEstimate_max': 5,
      'TaskRemainingTotal_variance': 81,
      'TaskRemainingTotal_standardDeviation': 9 
    }
    
    a = aggregate(list, aggregationSpec)
    
    test.deepEqual(a, expected)
    
    test.done()
    
  testAggregateAt: (test) ->    
    list1 = [
      { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 5, TaskRemainingTotal: 20 },
      { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: 3, TaskRemainingTotal: 6 },
      { ObjectID: '3', KanbanState: 'Ready to pull', PlanEstimate: 5, TaskRemainingTotal: 13 }
    ]
    
    list2 = [
      { ObjectID: '1', KanbanState: 'In progress', PlanEstimate: 0, TaskRemainingTotal: 0 },
      { ObjectID: '2', KanbanState: 'Ready to pull', PlanEstimate: -1, TaskRemainingTotal: 0 },
      { ObjectID: '4', KanbanState: 'In test', PlanEstimate: 0, TaskRemainingTotal: 0 }
    ]
    
    atArray = [list1, list2]
    
    aggregationSpec = [
      {field: 'TaskRemainingTotal', f: 'average'}
      {as: 'UniqueValues', field:'KanbanState', f:'addToSet'}
      {field: 'PlanEstimate', f: 'sumSquares'}
    ]
      
    expected = [ 
      { 
        'TaskRemainingTotal_average': 13,
        UniqueValues: [ 'In progress', 'Ready to pull' ],
        'PlanEstimate_sumSquares': 59 
      },
      { 
        'TaskRemainingTotal_average': 0,
        UniqueValues: [ 'In progress', 'Ready to pull', 'In test' ],
        'PlanEstimate_sumSquares': 1 
      } 
    ]
    
    a = aggregateAt(atArray, aggregationSpec)
    
    test.deepEqual(a, expected)
    
    test.done()