import React, { useEffect, useRef } from 'react';

const NeuralNetworkCanvas = ({ isActive }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    // Configuration
    const particleCount = isActive ? 80 : 35; // Mais partículas quando ativo
    const connectionDistance = isActive ? 120 : 80;
    const speedMultiplier = isActive ? 2.5 : 0.2; // Bem mais rápido quando ativo
    
    // Use a fixed purple color to ensure it renders correctly and matches the theme
    const getColor = (opacity) => `rgba(139, 92, 246, ${opacity})`;

    // Resize canvas
    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speedMultiplier,
        vy: (Math.random() - 0.5) * speedMultiplier,
        radius: Math.random() * 1.5 + (isActive ? 2.5 : 1.5), // Larger points
        pulseOffset: Math.random() * Math.PI * 2 // Para fazer o brilho pulsar
      });
    }

    // Animation loop
    let time = 0;
    const draw = () => {
      time += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections first (underneath points)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = 1 - (distance / connectionDistance);
            
            // Adiciona um efeito de pulso nas conexões quando ativo
            const pulse = isActive ? (Math.sin(time + p.pulseOffset) * 0.5 + 0.5) : 1;
            const finalOpacity = isActive ? opacity * 0.6 * pulse : opacity * 0.2;
            
            ctx.strokeStyle = getColor(finalOpacity);
            ctx.lineWidth = isActive ? (1 + pulse * 0.5) : 0.5;
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Movimento mais caótico/orgânico quando ativo
        if (isActive && Math.random() < 0.02) {
            p.vx += (Math.random() - 0.5) * 0.5;
            p.vy += (Math.random() - 0.5) * 0.5;
            
            // Limitar velocidade máxima
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > speedMultiplier * 1.5) {
                p.vx = (p.vx / speed) * speedMultiplier;
                p.vy = (p.vy / speed) * speedMultiplier;
            }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls smoothly
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        
        // Efeito de brilho pulsante nos nós quando ativo
        const nodePulse = isActive ? (Math.sin(time * 2 + p.pulseOffset) * 0.2 + 0.8) : 0.6;
        ctx.fillStyle = getColor(isActive ? nodePulse : 0.6);
        ctx.shadowBlur = isActive ? 12 * nodePulse : 0;
        ctx.shadowColor = getColor(0.9);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow for lines
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: isActive ? 1 : 0.5 }}
    />
  );
};

export default NeuralNetworkCanvas;
