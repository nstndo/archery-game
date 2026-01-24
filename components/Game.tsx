'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, usePublicClient } from 'wagmi';
import { base } from 'viem/chains';
import { useMiniKit, useComposeCast } from '@coinbase/onchainkit/minikit';

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

const CONTRACT_ADDRESS = "0x01317cE9Ae33F5A626A9477F25aFA07d73887aC9";

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
  displayName?: string;
  fid?: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isFrameReady, setFrameReady, context } = useMiniKit();
  const { composeCast } = useComposeCast();

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  const { data: hash, isPending, writeContract, reset: resetContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(10);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLevelComplete, setIsLevelComplete] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('light');

  const gameState = useRef<'playing' | 'gameover' | 'level_complete' | 'paused'>('playing');
  const stuckArrows = useRef<Arrow[]>([]);
  const flyingArrow = useRef<{ y: number } | null>(null);
  const particles = useRef<Particle[]>([]);
  const arrowsLeftRef = useRef(10);
  const rotation = useRef(0);
  const currentSpeed = useRef(0.04);
  const targetSpeed = useRef(0.04);
  const rotationChangeTimer = useRef(0);

  const screenDims = useRef({ width: 0, height: 0 });
  const assets = useRef({
    target: null as HTMLImageElement | null,
    shardB: null as HTMLImageElement | null,
    shardAse: null as HTMLImageElement | null,
    shardB_Blue: null as HTMLImageElement | null,
    shardAse_Blue: null as HTMLImageElement | null,
  });

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

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

  const fetchLeaderboard = async () => {
    if (!publicClient) return;

    setIsLoadingLeaderboard(true);
    setLeaderboardData([]);

    try {
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getLeaderboard',
      }) as any[];

      const formatted: LeaderboardEntry[] = data.map((item) => {
        const isCurrentUser = address ? item.wallet.toLowerCase() === address.toLowerCase() : false;
        
        let displayName: string | undefined;
        
        if (isCurrentUser && context?.user) {
          displayName = context.user.displayName || context.user.username || undefined;
        }
        
        return {
          address: item.wallet,
          level: Number(item.maxLevel),
          tokenId: item.tokenId.toString(),
          isCurrentUser,
          displayName,
          fid: isCurrentUser && context?.user ? context.user.fid : undefined
        };
      });

      formatted.sort((a, b) => b.level - a.level);
      setLeaderboardData(formatted);
    } catch (e) {
      console.error("Fetch leaderboard error", e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let targetRadius = 90;
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
      const startArrowY = height * 0.85;

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
  }, [level, currentTheme, context, address]);

  const shoot = () => {
    if (gameState.current !== 'playing' || flyingArrow.current || arrowsLeftRef.current <= 0) return;
    const h = screenDims.current.height;
    flyingArrow.current = { y: h * 0.85 };
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
    const embedUrl = 'https://base-archery-game.vercel.app';

    if (isFrameReady && context) {
      try {
        composeCast({
          text,
          embeds: [embedUrl]
        });
        return;
      } catch (e) {
        console.warn("MiniKit composeCast failed", e);
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Base Archery',
        text: text,
        url: embedUrl
      }).catch((err) => console.log('Share cancelled', err));
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const shareText = `${text}\n${embedUrl}`;
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Link copied to clipboard!');
      });
    }
  };

  const renderProfile = () => {
    if (context?.user) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-current max-w-[140px]">
          {context.user.pfpUrl && (
            <img 
              src={context.user.pfpUrl} 
              alt="pfp" 
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-sm font-medium truncate">
            {context.user.displayName || context.user.username}
          </span>
        </div>
      );
    }

    if (isConnected && address) {
      return (
        <button
          onClick={() => disconnect()}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-current transition-all active:scale-95 max-w-[140px] hover:opacity-70 ${currentTheme === 'light' ? 'border-gray-300' : 'border-white/20'}`}
        >
          <span className="text-sm font-medium">
            {address.slice(0, 4)}...{address.slice(-4)}
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={handleConnect}
        className="px-4 py-2 rounded-2xl bg-blue-600 text-white text-sm font-bold uppercase tracking-wider active:scale-95 transition-transform"
      >
        CONNECT
      </button>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden max-w-[600px] mx-auto"
      onPointerDown={handlePointerDown}
      style={{ 
        touchAction: 'none',
        background: currentTheme === 'dark' 
          ? 'linear-gradient(180deg, #000000 0%, #1a1a2e 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #e8f4ff 100%)'
      }}
    >
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      <div className="absolute inset-0 pointer-events-none flex flex-col" style={{ zIndex: 10 }}>
        <div className="top-bar pointer-events-auto flex items-center justify-between px-4 py-3">
          <h1 className={`text-lg font-black font-orbitron tracking-wider ${currentTheme === 'dark' ? 'text-white' : 'text-blue-900'}`}>
            BASE ARCHERY
          </h1>
          <button
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${currentTheme === 'dark' ? 'bg-white/10 text-white' : 'bg-blue-100 text-blue-600'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              {currentTheme === 'dark' ? (
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              ) : (
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              )}
            </svg>
          </button>
          {renderProfile()}
        </div>

        <div className="game-stats pointer-events-auto flex items-center justify-between px-4 mt-2">
          <button
            onClick={() => openModal('leaderboard')}
            className={`w-11 h-11 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </button>
          <div className="flex flex-col items-center">
            <div className={`text-sm font-bold font-orbitron ${currentTheme === 'dark' ? 'text-white' : 'text-blue-900'}`}>
              LEVEL {level}
            </div>
            <div className={`text-xs font-roboto ${currentTheme === 'dark' ? 'text-white/70' : 'text-blue-700/70'}`}>
              {arrowsLeft} ARROWS
            </div>
          </div>
          <button
            onClick={() => openModal('faq')}
            className={`w-11 h-11 rounded-full flex justify-center items-center backdrop-blur-sm border active:scale-90 transition-transform ${currentTheme === 'light' ? 'bg-blue-100/50 border-blue-200 text-blue-600' : 'bg-black/50 border-white/10 text-white'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 pointer-events-auto flex items-center justify-center p-4">
          {showLeaderboard && (
            <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
              <h2 className="text-2xl font-black font-orbitron text-center mb-4">LEADERBOARD</h2>
              {isLoadingLeaderboard ? (
                <div className="text-center py-8">LOADING...</div>
              ) : leaderboardData.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {leaderboardData.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-xl ${item.isCurrentUser ? 'bg-blue-500/20 border-2 border-blue-500' : currentTheme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold font-orbitron text-lg">#{i + 1}</span>
                        <div className="flex flex-col">
                          <span className="font-medium font-roboto">
                            {item.displayName || `${item.address.slice(0, 6)}...${item.address.slice(-4)}`}
                          </span>
                          <span className="text-xs opacity-70">Token ID: {item.tokenId}</span>
                        </div>
                      </div>
                      <div className="font-black font-orbitron text-xl">LVL {item.level}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 opacity-50">No champions yet.</div>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={fetchLeaderboard}
                  className={`flex-1 p-3 rounded-xl font-bold font-orbitron ${currentTheme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}
                >
                  Refresh
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 p-3 rounded-xl font-bold font-orbitron bg-blue-600 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!showLeaderboard && (
            <>
              {isGameOver && (
                <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                  <h2 className="text-3xl font-black font-orbitron text-center mb-2">GAME OVER</h2>
                  <p className="text-center mb-4 opacity-70 font-roboto">You hit another arrow!</p>
                  <div className="text-center mb-6">
                    <div className="text-sm opacity-70 mb-1 font-roboto">Level Reached</div>
                    <div className="text-6xl font-black font-orbitron text-blue-600">{level}</div>
                  </div>
                  {isConfirmed && (
                    <button
                      onClick={handleShare}
                      className="w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest bg-green-600 text-white mb-3"
                    >
                      SHARE ACHIEVEMENT
                    </button>
                  )}
                  <button
                    onClick={handleMint}
                    disabled={isPending || isConfirming}
                    className="w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest bg-blue-600 text-white mb-3 disabled:opacity-50"
                  >
                    {isPending ? 'Confirming...' : isConfirming ? 'Minting...' : isConfirmed ? 'Minted Successfully' : 'Mint Record NFT'}
                  </button>
                  <button
                    onClick={() => resetLevel(1)}
                    className={`w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest border ${currentTheme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10'}`}
                  >
                    Try Again
                  </button>
                </div>
              )}

              {isLevelComplete && (
                <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                  <h2 className="text-3xl font-black font-orbitron text-center mb-2">LEVEL COMPLETE!</h2>
                  <p className="text-center mb-6 opacity-70 font-roboto">Great shot! Ready for the next challenge?</p>
                  <button
                    onClick={() => resetLevel(level + 1)}
                    className="w-full p-4 rounded-2xl font-bold font-orbitron text-base uppercase tracking-widest bg-blue-600 text-white"
                  >
                    Next Level
                  </button>
                </div>
              )}

              {showFaq && (
                <div className={`modal-card w-full max-w-md p-6 rounded-3xl shadow-2xl ${currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                  <h2 className="text-2xl font-black font-orbitron text-center mb-4">GAME RULES</h2>
                  <div className="space-y-4 mb-6 font-roboto">
                    <div>
                      <h3 className="font-bold mb-1">HOW TO PLAY?</h3>
                      <p className="text-sm opacity-70">Tap anywhere to shoot. Fill the target without hitting other arrows.</p>
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">WHAT ARE NFTS?</h3>
                      <p className="text-sm opacity-70">Your high score can be minted as a unique NFT on the Base blockchain.</p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="w-full p-4 rounded-xl font-bold font-orbitron bg-blue-600 text-white"
                  >
                    Close
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}