"use client";

type AnimatedListGradientsProps = {
  topGradientOpacity: number;
  bottomGradientOpacity: number;
};

export function AnimatedListGradients({
  topGradientOpacity,
  bottomGradientOpacity,
}: AnimatedListGradientsProps) {
  return (
    <>
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-[50px] bg-linear-to-b from-background to-transparent transition-opacity"
        style={{ opacity: topGradientOpacity }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0 bottom-0 h-[100px] bg-linear-to-t from-background to-transparent transition-opacity"
        style={{ opacity: bottomGradientOpacity }}
      />
    </>
  );
}
