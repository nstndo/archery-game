'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, usePublicClient, useReadContract } from 'wagmi';
import { base } from 'viem/chains';
import sdk, { type FrameContext } from '@farcaster/frame-sdk';

// --- ABI ---
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

// ADDRESS
const CONTRACT_ADDRESS = "0x01317cE9Ae33F5A626A9477F25aFA07d73887aC9"; 

// --- Types ---
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
    isCurrentUser: boolean;
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
  const publicClient = usePublicClient(); // Используем для прямого чтения
  
  // Mint Hooks
  const { data: hash, isPending, writeContract, reset: resetContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Leaderboard Read Hook
  const { data: rawLeaderboard } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLeaderboard',
    chainId: base.id, 
    query: {
        enabled: true,
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
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('light');
  
  // Farcaster/Base App Context State
  const [frameContext, setFrameContext] = useState<FrameContext | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // Game Logic Refs
  const gameState = useRef<'playing' | 'gameover' | 'level_complete' | 'paused'>('playing');
  const stuckArrows = useRef<Arrow[]>([]);
  const flyingArrow = useRef<{ y: number } | null>(null);
  const particles = useRef<Particle[]>([]);
  const arrowsLeftRef = useRef(10); 
  
  const rotation = useRef(0);
  const currentSpeed = useRef(0.04);
  const targetSpeed = useRef(0.04);
  const rotationChangeTimer = useRef(0);
  
  // Screen Dimensions Ref
  const screenDims = useRef({ width: 0, height: 0 });

  const assets = useRef({
    target: null as HTMLImageElement | null,
    shardB: null as HTMLImageElement | null,
    shardAse: null as HTMLImageElement | null,
    shardB_Blue: null as HTMLImageElement | null,
    shardAse_Blue: null as HTMLImageElement | null,
  });

  // Base App SDK & Context Init
  useEffect(() => {
    const initSDK = async () => {
        try {
            const context = await sdk.context;
            setFrameContext(context);
            await sdk.actions.ready();
            setIsSDKLoaded(true);
        } catch (err) {
            // Silently fail if not in Frame environment
        }
    };
    initSDK();
  }, []);

  // Assets Init
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

  // Leaderboard Data Processing (Initial)
  useEffect(() => {
    if (rawLeaderboard) {
        const formatted: LeaderboardEntry[] = (rawLeaderboard as any[]).map((item) => ({
            address: item.wallet,
            level: Number(item.maxLevel),
            tokenId: item.tokenId.toString(),
            isCurrentUser: address ? item.wallet.toLowerCase() === address.toLowerCase() : false
        }));
        
        formatted.sort((a, b) => b.level - a.level);
        setLeaderboardData(formatted);
    }
  }, [rawLeaderboard, address]);

  // Main Game Loop & Resize Observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let targetRadius = 90; // Default
    const arrowLength = 65;

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            screenDims.current = { width, height };

            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Reduced target radius as requested
            targetRadius = width < 380 ? 70 : 80;
        }
    });

    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

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
      const { width, height } = screenDims.current;
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height * 0.45;
      // Lowered arrow start position (was 0.82)
      const startArrowY = height * 0.85; 

      // Draw Target
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
        // Fallback target
        ctx.beginPath();
        ctx.arc(0, 0, targetRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#0000ff';
        ctx.fill();
      }
      ctx.restore();

      // Draw Stuck Arrows
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.current);
      stuckArrows.current.forEach(a => drawArrow(0, 0, a.angle, true));
      ctx.restore();

      // Particles
      updateAndDrawParticles();

      // Physics
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
            // Speed increased from 25 to 40
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
                    
                    // Logic update via REF to avoid re-renders (FIXED FLICKER)
                    arrowsLeftRef.current -= 1;
                    setArrowsLeft(arrowsLeftRef.current);
                    
                    if (arrowsLeftRef.current <= 0) {
                        gameState.current = 'level_complete';
                        setIsLevelComplete(true);
                    }
                }
            }
        }
      }

      // Draw Active Arrow
      if (flyingArrow.current) {
        drawArrow(centerX, flyingArrow.current.y);
      } else if (arrowsLeftRef.current > 0 && gameState.current === 'playing') {
        drawArrow(centerX, startArrowY);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (containerRef.current) resizeObserver.unobserve(containerRef.current);
      cancelAnimationFrame(animationFrameId);
    };
  }, [level, currentTheme]);

  // --- Actions ---
  const shoot = () => {
    if (gameState.current !== 'playing' || flyingArrow.current || arrowsLeftRef.current <= 0) return;
    const h = screenDims.current.height; 
    flyingArrow.current = { y: h * 0.85 }; // Match start position logic
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.modal-card') || target.closest('.top-bar') || target.closest('.game-stats')) {
        return;
    }
    e.preventDefault();
    shoot();
  };

  const resetLevel = (lvl: number) => {
    if (resetContract) resetContract(); 
    
    setLevel(lvl);
    setArrowsLeft(10);
    arrowsLeftRef.current = 10;
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
        const injected = connectors.find((c) => c.type === 'injected');
        const coinbase = connectors.find((c) => c.id === 'coinbaseWalletSDK');
        const connector = injected || coinbase || connectors[0];
        if (connector) connect({ connector });
    }
  };

  const closeModal = () => {
    setShowFaq(false);
    setShowLeaderboard(false);
    if (gameState.current === 'paused') gameState.current = 'playing';
  };

  // --- MANUAL FETCH LEADERBOARD (FIXES REFRESH) ---
  const fetchLeaderboard = async () => {
    if (!publicClient) return;
    
    setIsLoadingLeaderboard(true);
    // Clear data to show loading state visually
    setLeaderboardData([]); 
    
    try {
        // Direct contract call bypassing hooks
        const data = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getLeaderboard',
        }) as any[];

        const formatted: LeaderboardEntry[] = data.map((item) => ({
            address: item.wallet,
            level: Number(item.maxLevel),
            tokenId: item.tokenId.toString(),
            isCurrentUser: address ? item.wallet.toLowerCase() === address.toLowerCase() : false
        }));
        
        formatted.sort((a, b) => b.level - a.level);
        setLeaderboardData(formatted);
    } catch (e) {
        console.error("Fetch leaderboard error", e);
    } finally {
        setIsLoadingLeaderboard(false);
    }
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
    if (chainId !== base.id) {
        try {
            await switchChain({ chainId: base.id });
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
        chain: base, 
    });
  };

  const handleShare = () => {
  const text = `I just reached Level ${level} in Base Archery! 🎯\n\nCan you beat my score? Mint your record on Base.`;
  const embeds = ["https://base-archery-game.vercel.app"];

  if (isSDKLoaded && sdk.actions?.composeCast) {
    try {
      sdk.actions.composeCast({
        text,
        embeds,
      });
      return;
    } catch (e) {
      console.error("composeCast failed", e);
    }
  }

  const encodedText = encodeURIComponent(text);
  const encodedEmbed = encodeURIComponent(embeds[0]);
  const shareUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedEmbed}`;
  window.open(shareUrl, '_blank');
};


  // Render Profile
  const renderProfile = () => {
    if (frameContext?.user) {
        return (
            <div className="flex items-center gap-3 bg-opacity-20 bg-white px-3 py-1.5 rounded-2xl border border-white/20 max-w-[150px]">
                {frameContext.user.pfpUrl && (
                    <img 
                        src={frameContext.user.pfpUrl} 
                        alt="Profile" 
                        className="w-6 h-6 rounded-full border border-white/30 flex-shrink-0"
                    />
                )}
                <span className={`font-bold text-sm tracking-wide truncate ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>
                    {frameContext.user.username}
                </span>
            </div>
        );
    }
    
    if (isConnected && address) {
        return (
            <button
                type="button" 
                onClick={() => disconnect()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-current transition-all active:scale-95 max-w-[140px] hover:opacity-70 ${currentTheme === 'light' ? 'border-gray-300' : 'border-white/20'}`}
            >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex-shrink-0" />
                <span className="font-bold text-xs tracking-wide truncate">
                    {address.slice(0, 4)}...{address.slice(-4)}
                </span>
            </button>
        );
    }

    return (
        <button 
            type="button"
            onClick={handleConnect}
            className={`px-4 py-2 rounded-2xl font-bold text-xs tracking-widest font-orbitron transition-all active:scale-95 border hover:opacity-70 ${currentTheme === 'light' ? 'border-gray-300' : 'border-white/20'}`}
        >
            CONNECT
        </button>
    );
  };

  return (
    <div 
        ref={containerRef}
        className={`fixed inset-0 w-full h-[100dvh] max-h-[100dvh] max-w-[480px] mx-auto flex flex-col overflow-hidden transition-colors duration-300 shadow-2xl ${currentTheme === 'light' ? 'bg-white text-black' : 'bg-[#000010] text-white'}`}
        onPointerDown={handlePointerDown}
    >
      
      {/* Canvas Layer - Absolute Background z-0 */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 block w-full h-full touch-none select-none z-0" 
      />

      {/* UI Layer - Sits on top (z-10), allows clicks through empty space */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        
        {/* Top Bar */}
        <div className={`top-bar flex justify-between items-center px-4 py-4 pt-[calc(15px+env(safe-area-inset-top))] backdrop-blur-md border-b transition-colors duration-300 flex-shrink-0 pointer-events-auto ${currentTheme === 'light' ? 'bg-white/85 border-blue-600/10' : 'bg-[#000020]/85 border-white/10'}`}>
            <div className="font-orbitron font-black text-lg flex items-center gap-2 uppercase tracking-wide flex-shrink-0">
            BASE <span className="text-[#0000ff]">ARCHERY</span>
            </div>
            <div className="flex gap-2 items-center flex-shrink-0 min-w-0">
                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors flex items-center justify-center">
                    {currentTheme === 'dark' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-sun"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    )}
                </button>
                {renderProfile()}
            </div>
        </div>

        {/* Stats Overlay */}
        <div className="game-stats w-full flex justify-center items-center gap-4 px-5 mt-4 pointer-events-auto">
            <button 
                type="button"
                onClick={() => openModal('leaderboard')}
                className={`w-11 h-11 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </button>
            
            <div className={`w-36 h-14 flex flex-col justify-center items-center rounded-2xl border backdrop-blur-sm text-center ${currentTheme === 'light' ? 'bg-blue-50/80 border-blue-200' : 'bg-black/50 border-white/10'}`}>
                <div className="text-base font-bold tracking-widest font-orbitron leading-none mb-1">LEVEL {level}</div>
                <div className="text-xs font-bold text-[#0000ff] font-orbitron leading-none">{arrowsLeft} ARROWS</div>
            </div>

            <button 
                type="button"
                onClick={() => openModal('faq')}
                className={`w-11 h-11 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
        </div>

      </div>

      {/* Modals Overlay */}
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity duration-300 z-50 ${isGameOver || isLevelComplete || showFaq || showLeaderboard ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`
            text-center transform transition-transform duration-300 border-t shadow-2xl flex flex-col w-full
            ${showLeaderboard ? 'h-full pt-[calc(20px+env(safe-area-inset-top))] rounded-none justify-start' : 'rounded-t-3xl p-6 pb-10 justify-end'}
            ${isGameOver || isLevelComplete || showFaq || showLeaderboard ? 'translate-y-0' : 'translate-y-full'} 
            ${currentTheme === 'light' ? 'bg-white border-blue-100' : 'bg-[#1a1a1a] border-white/10'}
        `}>
            
            {showLeaderboard && (
                <div className="flex flex-col h-full px-5 pb-8">
                    <h2 className={`font-orbitron text-2xl font-black mb-4 uppercase flex-shrink-0 text-center ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>LEADERBOARD</h2>
                    <div className={`flex-1 overflow-y-auto mb-4 font-roboto text-left ${currentTheme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {isLoadingLeaderboard ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="text-sm font-bold opacity-60 animate-pulse">LOADING...</div>
                            </div>
                        ) : leaderboardData.length > 0 ? (
                            <div className="space-y-2">
                                {leaderboardData.map((item, i) => (
                                    <div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${item.isCurrentUser ? 'border-[#0000ff] bg-blue-500/10' : (currentTheme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10')}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="text-lg font-black text-[#0000ff] w-6 flex-shrink-0">#{i + 1}</div>
                                            <div className="flex flex-col overflow-hidden">
                                                {/* REMOVED IDENTITY COMPONENT TO FIX RECTANGLE ISSUE */}
                                                <span className={`text-sm font-bold truncate ${item.isCurrentUser ? 'text-[#0000ff]' : ''}`}>
                                                  {item.isCurrentUser && frameContext?.user?.username 
                                                    ? frameContext.user.username 
                                                    : `${item.address.slice(0, 6)}...${item.address.slice(-4)}`
                                                  }
                                                </span>
                                                <span className="text-xs opacity-50">Token ID: {item.tokenId}</span>
                                            </div>
                                        </div>
                                        <div className="text-[#0000ff] font-black text-xl flex-shrink-0">LVL {item.level}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 opacity-70">No champions yet.</div>
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

            {!showLeaderboard && (
                <div className="text-center"> 
                    {isGameOver && (
                        <>
                            <h2 className={`font-orbitron text-2xl font-black mb-2 uppercase ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>GAME OVER</h2>
                            <p className="font-orbitron text-sm text-gray-500 mb-6 tracking-wide">You hit another arrow!</p>
                            <div className={`rounded-2xl p-5 mb-6 border flex justify-center items-center ${currentTheme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#252525] border-white/5'}`}>
                                <div className="text-center">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Level Reached</div>
                                    <div className="text-3xl font-black text-[#0000ff]">{level}</div>
                                </div>
                            </div>
                            {isConfirmed && (
                                <button onClick={handleShare} className={`w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest bg-[#0000ff] text-white shadow-lg shadow-blue-600/30 mb-3 active:scale-98 transition-transform`}>
                                    SHARE ACHIEVEMENT
                                </button>
                            )}
                            <button onClick={handleMint} disabled={isPending || isConfirming || isConfirmed} className={`w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest ${isConfirmed ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-[#0000ff] text-white shadow-lg shadow-blue-600/30'} mb-3 active:scale-98 transition-transform disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none border border-transparent`}>
                                {isPending ? 'Confirming...' : isConfirming ? 'Minting...' : isConfirmed ? 'Minted Successfully' : 'Mint Record NFT'}
                            </button>
                            <button onClick={() => resetLevel(1)} className={`w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest border active:scale-98 transition-transform ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                Try Again
                            </button>
                        </>
                    )}
                    {isLevelComplete && (
                        <>
                            <h2 className={`font-orbitron text-2xl font-black mb-2 uppercase ${currentTheme === 'light' ? 'text-black' : 'text-white'}`}>LEVEL COMPLETE!</h2>
                            <p className="font-orbitron text-sm text-gray-500 mb-8 tracking-wide">Great shot! Ready for the next challenge?</p>
                            <button onClick={() => resetLevel(level + 1)} className="w-full p-4 rounded-2xl font-orbitron font-black text-base uppercase tracking-widest bg-[#0000ff] text-white shadow-lg shadow-blue-600/30 active:scale-98 transition-transform">
                                Next Level
                            </button>
                        </>
                    )}
                    {showFaq && (
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
                </div>
            )}
        </div>
      </div>
    </div>
  );
}