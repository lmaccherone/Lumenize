###
JavaScript version from which this CoffeeScript version was derived by Ben Tilly <btilly@gmail.com>
which was derived from the Perl version by Michael Kospach <mike.perl@gmx.at>
both of which are licensed under the Perl Artistic License which allows linking from MIT licensed code.

Note: these are approximations good to 5 digits (which is good enough for almost every thing)

https://code.google.com/p/statistics-distributions-js/source/browse/trunk/statistics-distributions.js
###
distributions = {}  # !TODO: Rename all of these so they align (not exactly match) with Excel.
                    # Should distinguish between the probability density function (don't have any of these in here yet)
                    # and the cumulative form. Excel uses TRUE/FALSE as the last parameter to distinguish

distributions.fDist = (n, m, x) ->
  ###
  Upper probability of the F distribution
  ###
  p = undefined
  if x <= 0
    p = 1
  else if m % 2 is 0
    z = m / (m + n * x)
    a = 1
    i = m - 2

    while i >= 2
      a = 1 + (n + i - 2) / i * z * a
      i -= 2
    p = 1 - (Math.pow((1 - z), (n / 2)) * a)
  else if n % 2 is 0
    z = n * x / (m + n * x)
    a = 1
    i = n - 2

    while i >= 2
      a = 1 + (m + i - 2) / i * z * a
      i -= 2
    p = Math.pow((1 - z), (m / 2)) * a
  else
    y = Math.atan2(Math.sqrt(n * x / m), 1)
    z = Math.pow(Math.sin(y), 2)
    a = (if (n is 1) then 0 else 1)
    i = n - 2

    while i >= 3
      a = 1 + (m + i - 2) / i * z * a
      i -= 2
    b = Math.PI
    i = 2

    while i <= m - 1
      b *= (i - 1) / i
      i += 2
    p1 = 2 / b * Math.sin(y) * Math.pow(Math.cos(y), m) * a
    z = Math.pow(Math.cos(y), 2)
    a = (if (m is 1) then 0 else 1)
    i = m - 2

    while i >= 3
      a = 1 + (i - 1) / i * z * a
      i -= 2
    p = Math.max(0, p1 + 1 - 2 * y / Math.PI - 2 / Math.PI * Math.sin(y) * Math.cos(y) * a)
  return p

distributions.tInverseUpper = ($n, p) ->
  if p >= 1 or p <= 0
    throw new Error("Invalid p: p\n")
  if p is 0.5
    return 0
  else return -_subt($n, 1 - p)  if p < 0.5
  $u = _subu(p)
  $u2 = Math.pow($u, 2)
  $a = ($u2 + 1) / 4
  $b = ((5 * $u2 + 16) * $u2 + 3) / 96
  $c = (((3 * $u2 + 19) * $u2 + 17) * $u2 - 15) / 384
  $d = ((((79 * $u2 + 776) * $u2 + 1482) * $u2 - 1920) * $u2 - 945) / 92160
  $e = (((((27 * $u2 + 339) * $u2 + 930) * $u2 - 1782) * $u2 - 765) * $u2 + 17955) / 368640
  $x = $u * (1 + ($a + ($b + ($c + ($d + $e / $n) / $n) / $n) / $n) / $n)
  if $n <= Math.pow(log10(p), 2) + 3
    $round = undefined
    loop
      p1 = _subtprob($n, $x)
      $n1 = $n + 1
      $delta = (p1 - p) / Math.exp(($n1 * Math.log($n1 / ($n + $x * $x)) + Math.log($n / $n1 / 2 / Math.PI) - 1 + (1 / $n1 - 1 / $n) / 6) / 2)
      $x += $delta
      $round = round_to_precision($delta, Math.abs(integer(log10(Math.abs($x)) - 4)))
      break unless ($x) and ($round isnt 0)
  return $x

distributions.tDist = ($n, $x) ->
  $a = undefined
  $b = undefined
  $w = Math.atan2($x / Math.sqrt($n), 1)
  $z = Math.pow(Math.cos($w), 2)
  $y = 1
  $i = $n - 2

  while $i >= 2
    $y = 1 + ($i - 1) / $i * $z * $y
    $i -= 2
  if $n % 2 is 0
    $a = Math.sin($w) / 2
    $b = .5
  else
    $a = (if ($n is 1) then 0 else Math.sin($w) * Math.cos($w) / Math.PI)
    $b = .5 + $w / Math.PI
  return Math.max(0, 1 - $b - $a * $y)

distributions.normDist = ($x) ->  # equivalent to Excel's NORMSDIST
  p = 0
  $absx = Math.abs($x)
  if $absx < 1.9
    p = Math.pow((1 + $absx * (.049867347 + $absx * (.0211410061 + $absx * (.0032776263 + $absx * (.0000380036 + $absx * (.0000488906 + $absx * .000005383)))))), -16) / 2
  else if $absx <= 100
    $i = 18

    while $i >= 1
      p = $i / ($absx + p)
      $i--
    p = Math.exp(-.5 * $absx * $absx) / Math.sqrt(2 * Math.PI) / ($absx + p)
  p = 1 - p  if $x < 0
  return p

distributions.normInverseUpper = (p) ->
  $y = -Math.log(4 * p * (1 - p))
  $x = Math.sqrt($y * (1.570796288 +
                   $y * (.03706987906 +
                     $y * (-.8364353589e-3 +
                       $y * (-.2250947176e-3 +
                         $y * (.6841218299e-5 +
                           $y * (0.5824238515e-5 +
                             $y * (-.104527497e-5 +
                               $y * (.8360937017e-7 +
                                 $y * (-.3231081277e-8 +
                                   $y * (.3657763036e-10 +
                                     $y * .6936233982e-12)))))))))))
  $x = -$x  if p > .5
  return $x

distributions.normInverse = (p) ->  # equivalent to Excel's NORMSINV
  return distributions.normInverseUpper(1 - p)

exports.distributions = distributions