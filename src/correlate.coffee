correlate = (points, xField = 'x', yField = 'y') ->
  n = points.length

  sumX  = 0
  sumY  = 0
  sumXY = 0
  sumX2 = 0
  sumY2 = 0

  for point in points
    sumX  += point[xField]
    sumY  += point[yField]
    sumXY += point[xField] * point[yField]
    sumX2 += point[xField] * point[xField]
    sumY2 += point[yField] * point[yField]

  div = (n * sumX2) - (sumX * sumX)

  intercept = ((sumY * sumX2) - (sumX * sumXY)) / div
  slope = ((n * sumXY) - (sumX * sumY)) / div
  rSquared = Math.pow((n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)), 2)

  description = "y = #{slope} * x + #{intercept} with R^2 of #{rSquared}"

  return {intercept, slope, rSquared, description}

exports.correlate = correlate