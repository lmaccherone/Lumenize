multiRegression = {}


multiRegression.calculateA = (data) ->
  ###
  @method calculateA
    Calculates the coefficient matrix for gaussian elimination solution
  ###
  numOfVariables = data[0].length
  n = data.length
  a = []
  for i in [0..numOfVariables - 1]
    a.push([])
    for j in [0..numOfVariables]
      a[i].push(0)
      for k in [0..n - 1]
        a[i][j] += (if i is 0 then 1 else data[k][i - 1]) * (if j is 0 then 1 else data[k][j - 1])
  return a


multiRegression.swapRows = (a, firstRowIndex, secondRowIndex) ->
  for j in [0..a[0].length - 1]
    temp = a[firstRowIndex][j]
    a[firstRowIndex][j] = a[secondRowIndex][j]
    a[secondRowIndex][j] = temp



#		static double Predict(double[,] Data, double[] Inputs, ref double Range70, ref double Range90, ref double Variance, ref string ResultString)
predict = (data, inputs) ->
  ###
  @method predict
  @param {[][]} data A two-dimensional array
  @param

  Returns a prediction of the output based upon historical data and input "estimates"
  The last column of the Data array is the value we are trying to predict. The other
  columns are the inputs.  The input array will order-wise coorespond to the first
  n-1 columns of the data array.

  @return {Object}

  returns {A, Beta, variance, prediction}
  ###

#			int Rows=Data.GetLength(0);

#			int Columns=Data.GetLength(1);
#			if ( Columns>=Rows )
#			{
#				ResultString="Not enough data points.";
#				return -1;
#			}
#			if ( Columns<2 )
#			{
#				ResultString="Not enough columns.";
#				return -1;
#			}
#			double[,] a;
#			double[] x, Averages, RangeSums;
#			CalculateA(Data, out a);
#			ResultString=GuassSolve(a, out x);
#			if ( ResultString != "")
#			{
#				return -1;
#			}
#			double Answer=0;
#			double Multiplier=0;
#			for (int i=0; i<=a.GetLength(0)-1; i++)
#			{
#				if ( i==0 )
#					Multiplier=1;
#				else
#					Multiplier=Inputs[i-1];
#				Answer+=Multiplier*x[i];
#			}
#		    CalculateAverages(Data, out Averages);
#			CalculateRangeSums(Data, Averages, out RangeSums);
#			double Temp=0;
#			double Sum = 1.0 + (1.0/Rows);
#			for ( int j=0;j<=Columns-2;j++ )
#			{
#				Temp=Inputs[j]-Averages[j];
#				Sum+=(Temp*Temp)/RangeSums[j];
#			}
#			double SqrtSum=Math.Sqrt(Sum);
#			Variance=CalculateVariance(Data,x);
#			Range70=TWhenTDistIntegralEquals(.35, Rows-Columns)*Variance*SqrtSum;
#			Range90=TWhenTDistIntegralEquals(.45, Rows-Columns)*Variance*SqrtSum;
#			return Answer;
#		}

exports.multiRegression = multiRegression