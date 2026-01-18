import { useEffect, useRef } from "react";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrows: number[] = [];

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let rotation = 0;

    function draw() {
      ctx.clearRect(0, 0, 300, 300);

      // Circle
      ctx.beginPath();
      ctx.arc(150, 150, 100, 0, Math.PI * 2);
      ctx.stroke();

      // Arrows
      arrows.forEach(a => {
        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -100);
        ctx.lineTo(0, -130);
        ctx.stroke();
        ctx.restore();
      });

      rotation += 0.02;
      requestAnimationFrame(draw);
    }

    draw();

    canvas.onclick = () => {
      arrows.push(rotation);
    };
  }, []);

  return <canvas ref={canvasRef} width={300} height={300} />;
}