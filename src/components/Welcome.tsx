import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function BookScene({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0.3, 3.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8888ff, 0.3);
    rim.position.set(-2, 1, -2);
    scene.add(rim);

    // Book geometry
    const bookGroup = new THREE.Group();

    // Cover (front)
    const coverGeo = new THREE.BoxGeometry(1.4, 0.04, 1.9);
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.6, metalness: 0.1 });
    const frontCover = new THREE.Mesh(coverGeo, coverMat);
    frontCover.position.set(0, 0.12, 0);
    bookGroup.add(frontCover);

    // Cover (back)
    const backCover = new THREE.Mesh(coverGeo, coverMat);
    backCover.position.set(0, -0.12, 0);
    bookGroup.add(backCover);

    // Pages block
    const pagesGeo = new THREE.BoxGeometry(1.3, 0.2, 1.8);
    const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.9, metalness: 0 });
    const pages = new THREE.Mesh(pagesGeo, pagesMat);
    pages.position.set(0.02, 0, 0);
    bookGroup.add(pages);

    // Spine
    const spineGeo = new THREE.BoxGeometry(0.04, 0.28, 1.9);
    const spine = new THREE.Mesh(spineGeo, coverMat);
    spine.position.set(-0.7, 0, 0);
    bookGroup.add(spine);

    // Gold accent line on cover
    const accentGeo = new THREE.BoxGeometry(0.8, 0.005, 0.005);
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd4a44c, roughness: 0.3, metalness: 0.8 });
    const accent1 = new THREE.Mesh(accentGeo, accentMat);
    accent1.position.set(0, 0.145, 0.4);
    bookGroup.add(accent1);
    const accent2 = new THREE.Mesh(accentGeo, accentMat);
    accent2.position.set(0, 0.145, -0.4);
    bookGroup.add(accent2);

    bookGroup.rotation.x = -0.3;
    bookGroup.rotation.y = -0.4;
    scene.add(bookGroup);

    // Animation
    let frame = 0;
    const animate = () => {
      frame++;
      bookGroup.rotation.y = -0.4 + Math.sin(frame * 0.005) * 0.08;
      bookGroup.position.y = Math.sin(frame * 0.008) * 0.03;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [containerRef]);

  return null;
}

export default function Welcome() {
  const bookContainerRef = useRef<HTMLDivElement | null>(null);
  const [entering, setEntering] = useState(false);

  const handleOpen = () => {
    setEntering(true);
    setTimeout(() => { window.location.href = '/portfolio'; }, 800);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0a0c',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: entering ? 0 : 1,
      transform: entering ? 'scale(1.05)' : 'scale(1)',
      transition: 'opacity 0.8s ease, transform 0.8s ease',
    }}>
      {/* Book canvas */}
      <div
        ref={bookContainerRef}
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      >
        <BookScene containerRef={bookContainerRef} />
      </div>

      {/* Content overlay */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 12,
        pointerEvents: 'none',
      }}>
        <h1 style={{
          fontSize: 42, fontWeight: 300, letterSpacing: '-0.02em',
          color: '#fff', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Hudson Paine
        </h1>
        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.4)',
          margin: 0, fontStyle: 'italic', letterSpacing: '0.02em',
        }}>
          i'm an open book
        </p>

        <div style={{ display: 'flex', gap: 16, marginTop: 48, pointerEvents: 'all' }}>
          <button
            onClick={handleOpen}
            style={{
              position: 'relative',
              padding: '14px 32px',
              fontSize: 14,
              color: '#fff',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,255,255,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ position: 'relative', zIndex: 1 }}>open the book</span>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(212,164,76,0.1) 0%, transparent 50%, rgba(136,136,255,0.08) 100%)',
              opacity: 0.8,
            }} />
          </button>

          <a
            href="/graph"
            style={{
              padding: '14px 24px',
              fontSize: 14,
              color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              transition: 'all 0.3s ease',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <span style={{ fontSize: 12 }}>✦</span> space mode
          </a>
        </div>
      </div>
    </div>
  );
}
