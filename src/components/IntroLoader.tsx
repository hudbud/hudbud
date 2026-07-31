import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface IntroLoaderProps {
  onComplete: () => void;
}

function HudMarkWhite({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 330 329" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M203.833 290.257L126.128 290.242L119.865 283.999L210.104 284.006L203.833 290.257Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M191.322 302.728L138.66 302.729L132.395 296.484L197.579 296.491L191.322 302.728Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M178.794 315.217L151.188 315.219L144.924 308.974L185.051 308.979L178.794 315.217Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M164.992 328.975L157.453 321.46L172.526 321.465L164.992 328.975Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M113.13 177.859L51.2288 177.843L64.4456 190.991L45.5201 209.857L-1.88858e-05 164.479L45.4981 119.124L64.4263 137.993L51.2179 151.16L85.8397 151.164C91.5678 117.699 118.013 91.3369 151.569 85.6408L151.564 51.1284L138.356 64.2946L119.428 45.4259L164.94 0.0566261L210.526 45.3858L191.6 64.2519L178.389 51.0819L178.393 85.595C211.958 91.3071 238.414 117.68 244.144 151.14L278.712 151.147L265.502 137.978L284.427 119.112L329.929 164.556L284.431 209.911L265.503 191.042L278.705 177.899L256.937 177.893L256.929 177.885L216.79 177.868C217.914 173.586 218.518 169.097 218.527 164.467C218.518 135.182 194.334 111.074 164.956 111.064C135.563 111.067 111.388 135.166 111.399 164.452C111.406 169.069 112.003 173.567 113.13 177.859Z" fill="rgba(255,255,255,0.5)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M178.362 277.76L151.603 277.758L151.606 271.51L178.365 271.512L178.362 277.76Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M178.355 265.278L151.61 265.262L151.6 259.027L178.359 259.029L178.355 265.278Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M213.96 227.823L116.013 227.796C113.499 225.854 111.096 223.771 108.822 221.561L221.142 221.575C218.881 223.789 216.486 225.871 213.96 227.823Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M148.757 215.326L103.083 215.307C101.421 213.311 99.8655 211.223 98.4078 209.062L135.706 209.076C139.718 211.717 144.107 213.83 148.757 215.326Z" fill="rgba(255,255,255,0.8)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M190.673 240.308L139.325 240.291C134.462 238.639 129.804 236.54 125.4 234.046L204.58 234.061C200.19 236.558 195.541 238.655 190.673 240.308Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M127.879 202.832L94.5861 202.822C93.4634 200.797 92.4287 198.719 91.4989 196.576L122.317 196.58C124.009 198.804 125.86 200.904 127.879 202.832Z" fill="rgba(255,255,255,0.9)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M178.363 252.779L151.604 252.778L151.607 246.53L178.367 246.531L178.363 252.779Z" fill="rgba(255,255,255,0.3)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M118.212 190.334L89.0445 190.336C88.3474 188.284 87.716 186.211 87.1793 184.092L115.212 184.091C116.071 186.248 117.079 188.328 118.212 190.334Z" fill="#ffffff"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M226.884 215.331L181.14 215.327C185.798 213.833 190.181 211.724 194.201 209.084L231.551 209.093C230.103 211.242 228.538 213.331 226.884 215.331Z" fill="rgba(255,255,255,0.8)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M235.375 202.84L202.035 202.839C204.044 200.91 205.915 198.816 207.606 196.598L238.454 196.604C237.521 198.728 236.49 200.811 235.375 202.84Z" fill="rgba(255,255,255,0.9)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M240.901 190.358L211.723 190.35C212.842 188.354 213.845 186.27 214.716 184.112L242.76 184.122C242.233 186.227 241.603 188.315 240.901 190.358Z" fill="#ffffff"/>
    </svg>
  );
}

export default function IntroLoader({ onComplete }: IntroLoaderProps) {
  const timerRef = useRef<number>();

  useEffect(() => {
    // After 3 seconds, start fading out
    timerRef.current = window.setTimeout(() => {
      onComplete();
    }, 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg)',
        padding: 20,
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'var(--bg-inner)',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}>
        <video
          autoPlay
          muted
          playsInline
          loop
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.6,
          }}
        >
          <source src="/intro/intro.mp4" type="video/mp4" />
        </video>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <HudMarkWhite size={120} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'relative',
            zIndex: 1,
            color: '#fff',
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          watch a live stream
        </motion.p>
      </div>
    </motion.div>
  );
}
