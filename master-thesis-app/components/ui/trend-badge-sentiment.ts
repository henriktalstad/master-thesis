export type TrendBadgeSentimentProps = {
  upIsPositive?: boolean;
  invertColors?: boolean;
};

export function trendBadgeSentimentProps(
  isProduction: boolean,
): TrendBadgeSentimentProps {
  return isProduction ? { upIsPositive: true } : { invertColors: true };
}
