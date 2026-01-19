'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, useReadContract } from 'wagmi';
import { baseSepolia } from 'viem/chains';

// --- ABI Смарт-контракта (Включая getLeaderboard) ---
const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "level", type: "uint256" }],
    name: "mintScore",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "getLeaderboard",
    outputs: [
      {
        components: [
          { internalType: "address", name: "wallet", type: "address" },
          { internalType: "uint256", name: "maxLevel", type: "uint256" },
          { internalType: "uint256", name: "tokenId", type: "uint256" }
        ],
        internalType: "struct ArcheryScore.PlayerStats[]",
        name: "",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

// АДРЕС ВАШЕГО КОНТРАКТА
const CONTRACT_ADDRESS = "0x2441E2FfD92d63f003Fc63626e69FA79A7AaEEa7"; 

// --- Типы ---
interface Arrow {
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  rotation: number;
  rotSpeed: number;
  img: HTMLImageElement;
  size: number;
}

interface LeaderboardEntry {
    address: string;
    level: number;
    tokenId: string;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Web3 Hooks
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  // Хуки для записи в контракт (Минт)
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Хук для чтения Лидерборда
  const { data: rawLeaderboard, refetch: refetchLeaderboard, isLoading: isReadingLeaderboard } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLeaderboard',
    chainId: baseSepolia.id,
    query: {
        enabled: false, // Не загружать автоматически при старте
    }
  });

  // UI State
  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(10);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLevelComplete, setIsLevelComplete] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('light');

  // Game Logic Refs
  const gameState = useRef<'playing' | 'gameover' | 'level_complete' | 'paused'>('playing');
  const stuckArrows = useRef<Arrow[]>([]);
  const flyingArrow = useRef<{ y: number } | null>(null);
  const particles = useRef<Particle[]>([]);
  
  const rotation = useRef(0);
  const currentSpeed = useRef(0.04);
  const targetSpeed = useRef(0.04);
  const rotationChangeTimer = useRef(0);

  const assets = useRef({
    target: null as HTMLImageElement | null,
    shardB: null as HTMLImageElement | null,
    shardAse: null as HTMLImageElement | null,
    shardB_Blue: null as HTMLImageElement | null,
    shardAse_Blue: null as HTMLImageElement | null,
  });

  // Инициализация ассетов
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadImg = (src: string) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = src;
      return img;
    };
    assets.current.target = loadImg('https://base-archery-game.vercel.app/base-logo.webp');
    assets.current.shardB = loadImg('https://base-archery-game.vercel.app/b-white.webp');
    assets.current.shardAse = loadImg('https://base-archery-game.vercel.app/ase-white.webp');
    assets.current.shardB_Blue = loadImg('https://base-archery-game.vercel.app/b-blue.webp');
    assets.current.shardAse_Blue = loadImg('https://base-archery-game.vercel.app/ase-blue.webp');
  }, []);

  // Обработка данных лидерборда после загрузки
  useEffect(() => {
    if (rawLeaderboard) {
        // Приводим данные к нужному формату
        const formatted: LeaderboardEntry[] = (rawLeaderboard as any[]).map((item) => ({
            address: item.wallet,
            level: Number(item.maxLevel),
            tokenId: item.tokenId.toString()
        }));
        
        // Сортируем по убыванию уровня
        formatted.sort((a, b) => b.level - a.level);
        
        setLeaderboardData(formatted);
    }
  }, [rawLeaderboard]);

  // Основной игровой цикл
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let targetRadius = 90;
    const arrowLength = 65;

    const handleResize = () => {
      const parent = containerRef.current;
      if (parent) {
        width = parent.clientWidth;
        height = parent.clientHeight;
      } else {
        width = window.innerWidth;
        height = window.innerHeight;
      }
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      targetRadius = width < 380 ? 80 : 90;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const drawArrow = (x: number, y: number, angle?: number, isStuck = false) => {
      ctx.save();
      const color = currentTheme === 'dark' ? '#ffffff' : '#0000ff';
      ctx.fillStyle = color;
      ctx.shadowColor = currentTheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,255,0.4)';
      ctx.shadowBlur = 8;

      const headLen = 20;
      const headWidth = 12;
      const shaftWidth = 3;

      if (isStuck) {
        ctx.rotate(angle || 0);
        ctx.translate(targetRadius, 0);
        
        ctx.beginPath();
        ctx.roundRect(0, -1.5, arrowLength, 3, 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(12, -7);
        ctx.lineTo(8, 0);
        ctx.lineTo(12, 7);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        const tailX = arrowLength;
        ctx.moveTo(tailX - 14, 0);
        ctx.lineTo(tailX, -8);
        ctx.lineTo(tailX + 2, -8);
        ctx.lineTo(tailX - 4, 0);
        ctx.lineTo(tailX + 2, 8);
        ctx.lineTo(tailX, 8);
        ctx.closePath();
        ctx.fill();

      } else {
        ctx.translate(x, y);
        
        ctx.beginPath();
        ctx.roundRect(-1.5, 0, 3, arrowLength, 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(-7, 12);
        ctx.lineTo(0, 8);
        ctx.lineTo(7, 12);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        const tailY = arrowLength;
        ctx.moveTo(0, tailY - 14);
        ctx.lineTo(-8, tailY);
        ctx.lineTo(-8, tailY + 2);
        ctx.lineTo(0, tailY - 4);
        ctx.lineTo(8, tailY + 2);
        ctx.lineTo(8, tailY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    const spawnHitParticles = (x: number, y: number) => {
      const bImg = currentTheme === 'dark' ? assets.current.shardB : assets.current.shardB_Blue;
      const aseImg = currentTheme === 'dark' ? assets.current.shardAse : assets.current.shardAse_Blue;
      if (bImg) particles.current.push(createParticle(x, y, bImg, 24));
      if (aseImg) {
        for (let i = 0; i < 3; i++) particles.current.push(createParticle(x, y, aseImg, 18));
      }
    };

    const createParticle = (x: number, y: number, img: HTMLImageElement, size: number): Particle => ({
      x, y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 1) * 12,
      life: 1.0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      img,
      size
    });

    const updateAndDrawParticles = () => {
        for (let i = particles.current.length - 1; i >= 0; i--) {
            let p = particles.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5;
            p.rotation += p.rotSpeed;
            p.life -= 0.02;
            if (p.life <= 0) particles.current.splice(i, 1);
        }
        particles.current.forEach(p => {
            if (p.img.complete) {
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        });
    };

    const loop = () => {
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height * 0.35;
      const startArrowY = height * 0.82;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      if (assets.current.target && assets.current.target.complete) {
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(assets.current.target, -targetRadius, -targetRadius, targetRadius * 2, targetRadius * 2);
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.strokeStyle = currentTheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,255,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#0000ff';
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      stuckArrows.current.forEach(a => drawArrow(0, 0, a.angle, true));
      ctx.restore();

      updateAndDrawParticles();

      if (gameState.current === 'playing') {
        rotationChangeTimer.current--;
        if (rotationChangeTimer.current <= 0) {
            rotationChangeTimer.current = 60 + Math.random() * 120;
            const maxSpeed = 0.05 + (level * 0.005); 
            const dir = Math.random() > 0.5 ? 1 : -1;
            targetSpeed.current = Math.random() < 0.2 ? 0.01 * dir : (0.02 + Math.random() * maxSpeed) * dir;
        }
        currentSpeed.current += (targetSpeed.current - currentSpeed.current) * 0.03;
        rotation.current += currentSpeed.current;

        if (flyingArrow.current) {
            flyingArrow.current.y -= 40;
            const impactY = centerY + targetRadius;

            if (flyingArrow.current.y <= impactY) {
                flyingArrow.current.y = impactY;
                let hitAngle = (Math.PI / 2) - rotation.current;
                hitAngle = hitAngle % (Math.PI * 2);
                if (hitAngle < 0) hitAngle += Math.PI * 2;

                const collision = stuckArrows.current.some(a => {
                    let diff = Math.abs(a.angle - hitAngle);
                    if (diff > Math.PI) diff = (Math.PI * 2) - diff;
                    return diff < 0.04; 
                });

                if (collision) {
                    gameState.current = 'gameover';
                    setIsGameOver(true);
                } else {
                    stuckArrows.current.push({ angle: hitAngle });
                    flyingArrow.current = null;
                    spawnHitParticles(centerX, impactY);
                    setArrowsLeft(prev => {
                        const newVal = prev - 1;
                        if (newVal <= 0) {
                            gameState.current = 'level_complete';
                            setIsLevelComplete(true);
                        }
                        return newVal;
                    });
                }
            }
        }
      }

      if (flyingArrow.current) {
        drawArrow(centerX, flyingArrow.current.y);
      } else if (arrowsLeft > 0 && gameState.current === 'playing') {
        drawArrow(centerX, startArrowY);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [level, arrowsLeft, currentTheme]);

  const shoot = () => {
    if (gameState.current !== 'playing' || flyingArrow.current || arrowsLeft <= 0) return;
    const h = containerRef.current?.clientHeight || window.innerHeight;
    flyingArrow.current = { y: h * 0.82 };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.modal-card')) return;
    e.preventDefault();
    shoot();
  };

  const resetLevel = (lvl: number) => {
    setLevel(lvl);
    setArrowsLeft(10);
    stuckArrows.current = [];
    flyingArrow.current = null;
    particles.current = [];
    rotation.current = 0;
    gameState.current = 'playing';
    setIsGameOver(false);
    setIsLevelComplete(false);
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(newTheme);
    if (newTheme === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  };

  const handleConnect = () => {
    if (isConnected) {
        disconnect();
    } else {
        const coinbaseConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK');
        if (coinbaseConnector) connect({ connector: coinbaseConnector, chainId: baseSepolia.id });
    }
  };

  const closeModal = () => {
    setShowFaq(false);
    setShowLeaderboard(false);
    if (gameState.current === 'paused') gameState.current = 'playing';
  };

  const fetchLeaderboard = async () => {
    // Просто перезапрашиваем данные из хука useReadContract
    refetchLeaderboard();
  };

  const openModal = (type: 'faq' | 'leaderboard') => {
    gameState.current = 'paused';
    if (type === 'faq') setShowFaq(true);
    if (type === 'leaderboard') {
        setShowLeaderboard(true);
        fetchLeaderboard();
    }
  };

  const handleMint = async () => {
    if (!isConnected) {
        handleConnect();
        return;
    }
    if (chainId !== baseSepolia.id) {
        try {
            await switchChain({ chainId: baseSepolia.id });
            return;
        } catch (error) {
            console.error("Failed to switch chain", error);
            return;
        }
    }
    writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'mintScore',
        args: [BigInt(level)], 
        chain: baseSepolia, 
    });
  };

  return (
    <div 
        ref={containerRef}
        className={`fixed inset-0 w-full h-[100dvh] max-h-[100dvh] max-w-[480px] mx-auto flex flex-col overflow-hidden transition-colors duration-300 ${currentTheme === 'light' ? 'bg-white text-black' : 'bg-[#000010] text-white'}`}
        style={{ touchAction: 'none' }} 
    >
      <div className={`flex justify-between items-center px-5 py-4 pt-[calc(15px+env(safe-area-inset-top))] backdrop-blur-md z-10 border-b transition-colors duration-300 ${currentTheme === 'light' ? 'bg-white/85 border-blue-600/10' : 'bg-[#000020]/85 border-white/10'}`}>
        <div className="font-orbitron font-black text-xl flex items-center gap-2 uppercase tracking-wide">
          BASE <span className="text-[#0000ff]">ARCHERY</span>
        </div>
        <div className="flex gap-3 items-center">
            <button onClick={toggleTheme} className="p-1 hover:opacity-70 transition-opacity">
                {currentTheme === 'dark' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                )}
            </button>
            <button 
                onClick={handleConnect}
                className={`px-4 py-2 rounded-2xl font-bold text-xs tracking-widest font-orbitron transition-all active:scale-95 ${
                    isConnected 
                    ? 'bg-[#0000ff] text-white border-transparent' 
                    : (currentTheme === 'light' ? 'bg-gray-100 text-black border-blue-600/10' : 'bg-white/10 text-white border-white/20')
                } border`}
            >
            {isConnected 
                ? `${address?.slice(0, 4)}...${address?.slice(-4)}` 
                : 'CONNECT'}
            </button>
        </div>
      </div>

      <div className="absolute top-[calc(70px+env(safe-area-inset-top))] w-full flex justify-center items-center gap-4 z-10 pointer-events-none px-5">
        <button 
            onClick={() => openModal('leaderboard')}
            className={`w-11 h-11 rounded-full flex justify-center items-center backdrop-blur-sm border pointer-events-auto active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
        </button>
        <div className={`px-5 py-2 rounded-2xl border backdrop-blur-sm text-center min-w-[120px] ${currentTheme === 'light' ? 'bg-blue-50/80 border-blue-200' : 'bg-black/50 border-white/10'}`}>
            <div className="text-base font-bold tracking-widest font-orbitron">LEVEL {level}</div>
            <div className="text-sm font-bold text-[#0000ff] font-orbitron">{arrowsLeft} ARROWS</div>
        </div>
        <button 
            onClick={() => openModal('faq')}
            className={`w-11 h-11 rounded-full flex justify-center items-center backdrop-blur-sm border pointer-events-auto active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </button>
      </div>

      <canvas 
        ref={canvasRef} 
        className="block w-full h-full touch-none select-none"
        onPointerDown={handlePointerDown}
      />

      <div className={`absolute top-0 left-0 w-full h-full bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity duration-300 z-20 ${isGameOver || isLevelComplete || showFaq || showLeaderboard ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`
            text-center transform transition-transform duration-300 border-t shadow-2xl 
            ${showLeaderboard ? 'h-full rounded-none pt-[calc(20px+env(safe-area-inset-top))]' : 'rounded-t-3xl p-6 pb-10'}
            ${isGameOver || isLevelComplete || showFaq || showLeaderboard ? 'translate-y-0' : 'translate-y-full'} 
            ${currentTheme === 'light' ? 'bg-white border-blue-100' : 'bg-[#1a1a1a] border-white/10'}
            flex flex-col
        `}>
            
            {isGameOver && !showLeaderboard && (
                <>
                    <h2 className={`font-orbitron text-2xl font-black mb-2 uppercase ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>GAME OVER</h2>
                    <p className="font-orbitron text-sm text-gray-500 mb-6 tracking-wide">You hit another arrow!</p>
                    <div className={`rounded-2xl p-5 mb-6 border flex justify-center items-center ${currentTheme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#252525] border-white/5'}`}>
                        <div className="text-center">
                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Level Reached</div>
                            <div className="text-3xl font-black text-[#0000ff]">{level}</div>
                        </div>
                    </div>
                    <button onClick={handleMint} disabled={isPending || isConfirming} className={`w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest bg-[#0000ff] text-white shadow-lg shadow-blue-600/30 mb-3 active:scale-98 transition-transform disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {isPending ? 'Confirming...' : isConfirming ? 'Minting...' : isConfirmed ? 'Minted! ✅' : 'Mint Record NFT'}
                    </button>
                    <button onClick={() => resetLevel(1)} className={`w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest border active:scale-98 transition-transform ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                        Try Again
                    </button>
                </>
            )}

            {isLevelComplete && !showLeaderboard && (
                <>
                    <h2 className={`font-orbitron text-2xl font-black mb-2 uppercase ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>LEVEL COMPLETE!</h2>
                    <p className="font-orbitron text-sm text-gray-500 mb-8 tracking-wide">Great shot! Ready for the next challenge?</p>
                    <button onClick={() => resetLevel(level + 1)} className="w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest bg-[#0000ff] text-white shadow-lg shadow-blue-600/30 active:scale-98 transition-transform">
                        Next Level
                    </button>
                </>
            )}

            {showFaq && !showLeaderboard && (
                <>
                    <h2 className={`font-orbitron text-2xl font-black mb-6 uppercase ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>GAME RULES</h2>
                    <div className={`text-left mb-6 text-sm font-roboto space-y-4 ${currentTheme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        <div className="border-b pb-3 border-current border-opacity-10">
                            <div className="text-[#0000ff] font-bold mb-1">HOW TO PLAY?</div>
                            <div>Tap anywhere to shoot. Fill the target without hitting other arrows.</div>
                        </div>
                        <div className="border-b pb-3 border-current border-opacity-10">
                            <div className="text-[#0000ff] font-bold mb-1">WHAT ARE NFTS?</div>
                            <div>Your high score can be minted as a unique NFT on the Base blockchain.</div>
                        </div>
                    </div>
                    <button onClick={closeModal} className={`w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest border active:scale-98 transition-transform ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                        Close
                    </button>
                </>
            )}

            {showLeaderboard && (
                <div className="flex flex-col h-full px-5 pb-5">
                    <h2 className={`font-orbitron text-2xl font-black mb-6 uppercase flex-shrink-0 ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>LEADERBOARD</h2>
                    <div className={`flex-1 overflow-y-auto mb-4 font-roboto text-left ${currentTheme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {isReadingLeaderboard ? (
                            <div className="text-center py-10">Loading blockchain data...</div>
                        ) : leaderboardData.length > 0 ? (
                            <div className="space-y-2">
                                {leaderboardData.map((item, i) => (
                                    <div key={i} className={`flex justify-between items-center p-4 rounded-xl border ${currentTheme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="text-lg font-black text-[#0000ff] w-6">#{i + 1}</div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{item.address.slice(0, 6)}...{item.address.slice(-4)}</span>
                                                <span className="text-xs opacity-50">Token ID: {item.tokenId}</span>
                                            </div>
                                        </div>
                                        <div className="text-[#0000ff] font-black text-xl">LVL {item.level}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 opacity-70">No records found yet. Be the first!</div>
                        )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 mt-auto">
                        <button onClick={fetchLeaderboard} className={`flex-1 p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest border active:scale-98 transition-transform ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                            Refresh
                        </button>
                        <button onClick={closeModal} className={`flex-1 p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest border active:scale-98 transition-transform ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                            Close
                        </button>
                    </div>
                </div>
            )}

        </div>
      </div>

    </div>
  );
}