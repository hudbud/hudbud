import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';

type Field = 'gin' | 'vermouth' | 'water' | 'total';
type Unit = 'oz' | 'ml' | 'g';
type Mode = 'simple' | 'expert';
type SolveFor = 'water' | 'abv';

interface ExpertIngredient {
  id: string;
  name: string;
  volume: string;
  abv: string;
}

const RATIO_PRESETS = [
  { label: '3:1', value: 3 },
  { label: '4:1', value: 4 },
  { label: '5:1', value: 5 },
  { label: '6:1', value: 6 },
];

const UNITS: { id: Unit; label: string }[] = [
  { id: 'oz', label: 'oz' },
  { id: 'ml', label: 'ml' },
  { id: 'g', label: 'g' },
];

const ML_PER_OZ = 29.5735;
const DENSITY = { gin: 0.952, vermouth: 0.99, water: 1.0 } as const;
const ABV = { gin: 0.4, vermouth: 0.17 } as const;
const ABV_TARGET = { min: 30, max: 33 } as const;

interface Computed {
  gin: number;
  vermouth: number;
  water: number;
  total: number;
}

function inputToMl(field: Field, value: number, unit: Unit, ratio: number, waterFrac: number): number {
  if (unit === 'ml') return value;
  if (unit === 'oz') return value * ML_PER_OZ;
  if (field === 'gin') return value / DENSITY.gin;
  if (field === 'vermouth') return value / DENSITY.vermouth;
  if (field === 'water') return value / DENSITY.water;
  const denom = (ratio * DENSITY.gin + DENSITY.vermouth) / (ratio + 1) + waterFrac * DENSITY.water;
  const spirit_ml = denom > 0 ? value / denom : 0;
  return spirit_ml * (1 + waterFrac);
}

function mlToDisplay(field: Field, ml: number, unit: Unit): number {
  if (unit === 'ml') return ml;
  if (unit === 'oz') return ml / ML_PER_OZ;
  if (field === 'gin') return ml * DENSITY.gin;
  if (field === 'vermouth') return ml * DENSITY.vermouth;
  if (field === 'water') return ml * DENSITY.water;
  return ml;
}

function compute(anchor: Field, value: number, ratio: number, waterPct: number, unit: Unit): Computed {
  const w = waterPct / 100;
  if (!isFinite(value) || value <= 0) return { gin: 0, vermouth: 0, water: 0, total: 0 };

  let gin_ml = 0;
  let vermouth_ml = 0;
  let water_ml = 0;
  let spirit_ml = 0;

  if (anchor === 'gin') {
    gin_ml = inputToMl('gin', value, unit, ratio, w);
    vermouth_ml = ratio > 0 ? gin_ml / ratio : 0;
    spirit_ml = gin_ml + vermouth_ml;
    water_ml = spirit_ml * w;
  } else if (anchor === 'vermouth') {
    vermouth_ml = inputToMl('vermouth', value, unit, ratio, w);
    gin_ml = vermouth_ml * ratio;
    spirit_ml = gin_ml + vermouth_ml;
    water_ml = spirit_ml * w;
  } else if (anchor === 'water') {
    water_ml = inputToMl('water', value, unit, ratio, w);
    spirit_ml = w > 0 ? water_ml / w : 0;
    gin_ml = spirit_ml * (ratio / (ratio + 1));
    vermouth_ml = spirit_ml / (ratio + 1);
  } else {
    const total_ml = inputToMl('total', value, unit, ratio, w);
    spirit_ml = total_ml / (1 + w);
    gin_ml = spirit_ml * (ratio / (ratio + 1));
    vermouth_ml = spirit_ml / (ratio + 1);
    water_ml = spirit_ml * w;
  }

  const total_ml = gin_ml + vermouth_ml + water_ml;
  return { gin: gin_ml, vermouth: vermouth_ml, water: water_ml, total: total_ml };
}

function fmt(n: number, unit: Unit): string {
  if (!isFinite(n) || n === 0) return '0';
  if (unit === 'g' || unit === 'ml') {
    if (n < 1) return n.toFixed(2);
    if (n < 100) return n.toFixed(1);
    return Math.round(n).toString();
  }
  if (n < 0.01) return n.toFixed(3);
  if (n < 10) return n.toFixed(2);
  return n.toFixed(1);
}

function convertVolume(value: number, from: Unit, to: Unit): number {
  if (from === to || !isFinite(value)) return value;
  if (from === 'oz' && to === 'ml') return value * ML_PER_OZ;
  if (from === 'ml' && to === 'oz') return value / ML_PER_OZ;
  return value;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const cellLabel: CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 8,
};

const cellLabelEmbed: CSSProperties = {
  fontSize: 11,
  color: 'var(--fg-dim)',
  marginBottom: 8,
};

const segBtn = (active: boolean): CSSProperties => ({
  padding: '5px 10px',
  background: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.04)',
  color: active ? '#0a0a0a' : 'rgba(255,255,255,0.7)',
  border: `1px solid ${active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: 999,
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  cursor: 'pointer',
  transition: 'all 0.15s',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
});

const segBtnEmbed = (active: boolean): CSSProperties => ({
  padding: '5px 10px',
  background: active ? 'var(--fg)' : 'var(--tile)',
  color: active ? 'var(--bg)' : 'var(--fg-dim)',
  border: `1px solid ${active ? 'var(--fg)' : 'var(--rule)'}`,
  borderRadius: 999,
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const inputBase: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  outline: 'none',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

const inputBaseEmbed: CSSProperties = {
  background: 'var(--tile)',
  color: 'var(--fg)',
  border: '1px solid var(--rule)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  outline: 'none',
};

function TogglePill({ on, onClick, label, embedded = false }: { on: boolean; onClick: () => void; label: string; embedded?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px 4px 8px',
        background: embedded ? (on ? 'var(--tile)' : 'transparent') : (on ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'),
        border: `1px solid ${embedded ? 'var(--rule)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 999,
        color: embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.7)',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 12,
          borderRadius: 999,
          background: embedded ? (on ? 'var(--accent)' : 'var(--rule)') : (on ? 'rgba(180,210,255,0.55)' : 'rgba(255,255,255,0.12)'),
          position: 'relative',
          transition: 'background 0.15s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: on ? 11 : 1,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: embedded ? (on ? 'var(--bg)' : 'var(--fg-dim)') : (on ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'),
            transition: 'left 0.15s',
          }}
        />
      </span>
      {label}
    </button>
  );
}

export default function FreezerMartini({ embedded = false }: { embedded?: boolean } = {}) {
  const [ratio, setRatio] = useState<number>(5);
  const [ratioInput, setRatioInput] = useState<string>('5');
  const [waterPct, setWaterPct] = useState<number>(15);
  const [waterInput, setWaterInput] = useState<string>('15');
  const [unit, setUnit] = useState<Unit>('oz');

  const [anchor, setAnchor] = useState<Field>('gin');
  const [anchorInput, setAnchorInput] = useState<string>('5');

  const [showAbv, setShowAbv] = useState<boolean>(false);
  const [mode, setMode] = useState<Mode>('simple');

  const [solveFor, setSolveFor] = useState<SolveFor>('water');
  const [targetAbv, setTargetAbv] = useState<string>('32');
  const [expertWater, setExpertWater] = useState<string>('');
  const [ingredients, setIngredients] = useState<ExpertIngredient[]>([]);

  useEffect(() => {
    document.body.style.background = '#000';
    document.body.style.margin = '0';
    document.documentElement.style.background = '#000';
  }, []);

  const computed = useMemo(() => {
    const n = parseFloat(anchorInput);
    return compute(anchor, isNaN(n) ? 0 : n, ratio, waterPct, unit);
  }, [anchor, anchorInput, ratio, waterPct, unit]);

  const expert = useMemo(() => {
    const rows = ingredients.map((r) => ({
      vol: parseFloat(r.volume) || 0,
      abv: (parseFloat(r.abv) || 0) / 100,
    }));
    const spiritVol = rows.reduce((s, r) => s + r.vol, 0);
    const spiritAlcohol = rows.reduce((s, r) => s + r.vol * r.abv, 0);

    if (solveFor === 'water') {
      const target = (parseFloat(targetAbv) || 0) / 100;
      let water = 0;
      let final = 0;
      let unreachable = false;
      if (target > 0 && spiritVol > 0) {
        water = spiritAlcohol / target - spiritVol;
        if (water < 0) {
          water = 0;
          unreachable = true;
          final = spiritAlcohol / spiritVol;
        } else {
          final = target;
        }
      } else if (spiritVol > 0) {
        final = spiritAlcohol / spiritVol;
      }
      return { spiritVol, water, finalAbv: final * 100, total: spiritVol + water, unreachable };
    }
    const water = parseFloat(expertWater) || 0;
    const total = spiritVol + water;
    const final = total > 0 ? spiritAlcohol / total : 0;
    return { spiritVol, water, finalAbv: final * 100, total, unreachable: false };
  }, [ingredients, solveFor, targetAbv, expertWater]);

  const valueFor = (f: Field): string => {
    if (f === anchor) return anchorInput;
    return fmt(mlToDisplay(f, computed[f], unit), unit);
  };

  const onFieldChange = (f: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    setAnchor(f);
    setAnchorInput(v);
  };

  const onRatioPreset = (v: number) => {
    setRatio(v);
    setRatioInput(String(v));
  };

  const onRatioInput = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    setRatioInput(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0) setRatio(n);
  };

  const onWaterInput = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    setWaterInput(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 0) setWaterPct(n);
  };

  const onUnitChange = (next: Unit) => {
    if (next === unit) return;
    if (mode === 'simple') {
      const n = parseFloat(anchorInput);
      if (!isNaN(n) && n > 0) {
        const displayed = mlToDisplay(anchor, computed[anchor], next);
        setAnchorInput(fmt(displayed, next));
      }
    } else {
      setIngredients((prev) =>
        prev.map((r) => {
          const v = parseFloat(r.volume);
          if (isNaN(v) || v === 0) return r;
          return { ...r, volume: fmt(convertVolume(v, unit, next), next) };
        })
      );
      const w = parseFloat(expertWater);
      if (!isNaN(w) && w > 0) {
        setExpertWater(fmt(convertVolume(w, unit, next), next));
      }
    }
    setUnit(next);
  };

  const onModeChange = (next: Mode) => {
    if (next === mode) return;
    if (next === 'expert' && unit === 'g') setUnit('oz');
    setMode(next);
  };

  const onIngredientField = (id: string, key: keyof Omit<ExpertIngredient, 'id'>) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if ((key === 'volume' || key === 'abv') && v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    setIngredients((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { id: newId(), name: '', volume: '', abv: '' }]);
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((r) => r.id !== id));
  };

  const onTargetAbvChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    setTargetAbv(v);
  };

  const onExpertWaterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    setExpertWater(v);
  };

  const fields: { id: Field; label: string }[] = [
    { id: 'gin', label: 'gin' },
    { id: 'vermouth', label: 'vermouth' },
    { id: 'water', label: 'water' },
    { id: 'total', label: 'total' },
  ];

  const ratioMatchesPreset = RATIO_PRESETS.some((p) => p.value === ratio && String(p.value) === ratioInput);
  const visibleUnits = mode === 'expert' ? UNITS.filter((u) => u.id !== 'g') : UNITS;

  const simpleAbv = (() => {
    const total = computed.gin + computed.vermouth + computed.water;
    return total > 0 ? ((computed.gin * ABV.gin + computed.vermouth * ABV.vermouth) / total) * 100 : 0;
  })();
  const currentAbv = mode === 'simple' ? simpleAbv : expert.finalAbv;
  const tooLow = currentAbv > 0 && currentAbv < ABV_TARGET.min;
  const abvVisible = showAbv || tooLow;

  const _cellLabel = embedded ? cellLabelEmbed : cellLabel;
  const _segBtn = embedded ? segBtnEmbed : segBtn;
  const _inputBase = embedded ? inputBaseEmbed : inputBase;

  const content = (
    <>
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <a
            href="/"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          >
            ← paine.design
          </a>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>idea · 01</span>
        </div>
      )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13, letterSpacing: '0.01em', color: embedded ? 'var(--accent)' : 'rgba(220,235,255,0.95)' }}>
            freezer martini calculator
          </div>
          <TogglePill embedded={embedded} on={mode === 'expert'} onClick={() => onModeChange(mode === 'expert' ? 'simple' : 'expert')} label="expert mode" />
        </div>
        <p style={{ color: embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.55, margin: 0, maxWidth: '50ch' }}>
          {mode === 'simple'
            ? 'Pick a ratio, set dilution, type any volume into any field — the rest follows.'
            : 'Add each ingredient with its ABV. Solve for the water that hits your target ABV, or plug in water to see the resulting ABV.'}
        </p>

        {mode === 'simple' ? (
          <SimpleControls
            ratio={ratio}
            ratioInput={ratioInput}
            ratioMatchesPreset={ratioMatchesPreset}
            onRatioPreset={onRatioPreset}
            onRatioInput={onRatioInput}
            waterInput={waterInput}
            onWaterInput={onWaterInput}
            unit={unit}
            visibleUnits={visibleUnits}
            onUnitChange={onUnitChange}
            embedded={embedded}
          />
        ) : (
          <ExpertControls
            unit={unit}
            visibleUnits={visibleUnits}
            onUnitChange={onUnitChange}
            ingredients={ingredients}
            onIngredientField={onIngredientField}
            removeIngredient={removeIngredient}
            addIngredient={addIngredient}
            solveFor={solveFor}
            setSolveFor={setSolveFor}
            targetAbv={targetAbv}
            onTargetAbvChange={onTargetAbvChange}
            expertWater={expertWater}
            onExpertWaterChange={onExpertWaterChange}
            expert={expert}
            embedded={embedded}
          />
        )}

        {mode === 'simple' && (
          <div style={{ marginTop: 22, borderTop: `1px solid ${embedded ? 'var(--rule)' : 'rgba(255,255,255,0.08)'}` }}>
            {fields.map((f, i) => {
              const isTotal = f.id === 'total';
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 12,
                    padding: '12px 0',
                    alignItems: 'center',
                    borderBottom: i < fields.length - 1 ? `1px solid ${embedded ? 'var(--rule)' : 'rgba(255,255,255,0.06)'}` : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: embedded ? (isTotal ? 'var(--accent)' : 'var(--fg)') : (isTotal ? 'rgba(220,235,255,0.95)' : 'rgba(255,255,255,0.85)'),
                      fontWeight: isTotal ? 500 : 400,
                    }}
                  >
                    {f.label}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valueFor(f.id)}
                    onChange={onFieldChange(f.id)}
                    onFocus={(e) => e.target.select()}
                    style={{
                      ..._inputBase,
                      width: 100,
                      padding: '8px 10px',
                      fontSize: 14,
                      textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: 12, color: embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.5)', minWidth: 16, textAlign: 'left' }}>
                    {unit}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <TogglePill embedded={embedded} on={showAbv} onClick={() => setShowAbv((v) => !v)} label="show abv" />
          {abvVisible && (
            <span
              style={{
                fontSize: 13,
                color: tooLow ? 'rgba(255,170,170,0.95)' : (embedded ? 'var(--accent)' : 'rgba(220,235,255,0.95)'),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {currentAbv.toFixed(1)}%
              {tooLow && (
                <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,170,170,0.85)' }}>
                  below {ABV_TARGET.min}% — may freeze
                </span>
              )}
            </span>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 11, color: embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
          Batch the gin + vermouth in a bottle, add the water, freeze. Water lowers the freezing point so the whole
          bottle pours cold and just-diluted.
        </div>
    </>
  );

  if (embedded) {
    return <div style={{ color: 'var(--fg)', fontFamily: 'inherit' }}>{content}</div>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at top, rgba(60,90,140,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(120,80,140,0.1), transparent 50%), #000',
        color: 'rgba(255,255,255,0.95)',
        padding: '40px 20px',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '24px 26px 26px',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)',
        }}
      >
        {content}
      </div>
    </div>
  );
}

function SimpleControls({
  ratio,
  ratioInput,
  ratioMatchesPreset,
  onRatioPreset,
  onRatioInput,
  waterInput,
  onWaterInput,
  unit,
  visibleUnits,
  onUnitChange,
  embedded = false,
}: {
  ratio: number;
  ratioInput: string;
  ratioMatchesPreset: boolean;
  onRatioPreset: (v: number) => void;
  onRatioInput: (e: ChangeEvent<HTMLInputElement>) => void;
  waterInput: string;
  onWaterInput: (e: ChangeEvent<HTMLInputElement>) => void;
  unit: Unit;
  visibleUnits: { id: Unit; label: string }[];
  onUnitChange: (u: Unit) => void;
  embedded?: boolean;
}) {
  const _cellLabel = embedded ? cellLabelEmbed : cellLabel;
  const _segBtn = embedded ? segBtnEmbed : segBtn;
  const _inputBase = embedded ? inputBaseEmbed : inputBase;
  return (
    <div style={{ marginTop: 22, display: 'grid', gap: 16 }}>
      <div>
        <div style={_cellLabel}>gin : vermouth</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {RATIO_PRESETS.map((p) => (
            <button key={p.value} onClick={() => onRatioPreset(p.value)} style={_segBtn(ratio === p.value && ratioMatchesPreset)}>
              {p.label}
            </button>
          ))}
          <input
            type="text"
            inputMode="decimal"
            value={ratioInput}
            onChange={onRatioInput}
            aria-label="custom ratio"
            style={{ ..._inputBase, width: 50, padding: '5px 8px', fontSize: 11, textAlign: 'right', marginLeft: 4 }}
          />
          <span style={{ fontSize: 12, color: embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.5)' }}>: 1</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={_cellLabel}>water</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              inputMode="decimal"
              value={waterInput}
              onChange={onWaterInput}
              style={{ ..._inputBase, width: 56, padding: '5px 8px', fontSize: 11, textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.5)' }}>%</span>
            <span style={{ fontSize: 11, color: embedded ? 'var(--fg-faint)' : 'rgba(255,255,255,0.4)', marginLeft: 4 }}>(15% recommended)</span>
          </div>
        </div>

        <div>
          <div style={_cellLabel}>units</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {visibleUnits.map((u) => (
              <button key={u.id} onClick={() => onUnitChange(u.id)} style={_segBtn(unit === u.id)}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExpertResult {
  spiritVol: number;
  water: number;
  finalAbv: number;
  total: number;
  unreachable: boolean;
}

function ExpertControls({
  unit,
  visibleUnits,
  onUnitChange,
  ingredients,
  onIngredientField,
  removeIngredient,
  addIngredient,
  solveFor,
  setSolveFor,
  targetAbv,
  onTargetAbvChange,
  expertWater,
  onExpertWaterChange,
  expert,
  embedded = false,
}: {
  unit: Unit;
  visibleUnits: { id: Unit; label: string }[];
  onUnitChange: (u: Unit) => void;
  ingredients: ExpertIngredient[];
  onIngredientField: (id: string, key: keyof Omit<ExpertIngredient, 'id'>) => (e: ChangeEvent<HTMLInputElement>) => void;
  removeIngredient: (id: string) => void;
  addIngredient: () => void;
  solveFor: SolveFor;
  setSolveFor: (s: SolveFor) => void;
  targetAbv: string;
  onTargetAbvChange: (e: ChangeEvent<HTMLInputElement>) => void;
  expertWater: string;
  onExpertWaterChange: (e: ChangeEvent<HTMLInputElement>) => void;
  expert: ExpertResult;
  embedded?: boolean;
}) {
  const _cellLabel = embedded ? cellLabelEmbed : cellLabel;
  const _segBtn = embedded ? segBtnEmbed : segBtn;
  const _inputBase = embedded ? inputBaseEmbed : inputBase;
  const dimColor = embedded ? 'var(--fg-dim)' : 'rgba(255,255,255,0.5)';
  const faintColor = embedded ? 'var(--fg-faint)' : 'rgba(255,255,255,0.4)';
  const fgColor = embedded ? 'var(--fg)' : 'rgba(255,255,255,0.85)';
  const accentColor = embedded ? 'var(--accent)' : 'rgba(220,235,255,0.95)';
  const ruleColor = embedded ? 'var(--rule)' : 'rgba(255,255,255,0.08)';
  return (
    <div style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <div>
        <div style={_cellLabel}>units</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {visibleUnits.map((u) => (
            <button key={u.id} onClick={() => onUnitChange(u.id)} style={_segBtn(unit === u.id)}>
              {u.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={_cellLabel}>ingredients</div>
          <button onClick={addIngredient} style={{ ..._segBtn(false), padding: '4px 10px' }}>+ add</button>
        </div>
        {ingredients.length === 0 ? (
          <div
            style={{
              padding: '14px 12px',
              border: `1px dashed ${ruleColor}`,
              borderRadius: 8,
              fontSize: 12,
              color: faintColor,
              textAlign: 'center',
            }}
          >
            no ingredients yet — add your spirits, modifiers, and bitters
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 64px 22px',
                gap: 8,
                fontSize: 10,
                color: faintColor,
                padding: '0 4px',
              }}
            >
              <span>name</span>
              <span style={{ textAlign: 'right' }}>vol ({unit})</span>
              <span style={{ textAlign: 'right' }}>abv %</span>
              <span />
            </div>
            {ingredients.map((row) => (
              <div
                key={row.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 80px 64px 22px', gap: 8, alignItems: 'center' }}
              >
                <input
                  type="text"
                  value={row.name}
                  placeholder="e.g. Beefeater"
                  onChange={onIngredientField(row.id, 'name')}
                  style={{ ..._inputBase, padding: '7px 10px', fontSize: 12 }}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.volume}
                  onChange={onIngredientField(row.id, 'volume')}
                  style={{ ..._inputBase, padding: '7px 10px', fontSize: 12, textAlign: 'right' }}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.abv}
                  onChange={onIngredientField(row.id, 'abv')}
                  style={{ ..._inputBase, padding: '7px 10px', fontSize: 12, textAlign: 'right' }}
                />
                <button
                  onClick={() => removeIngredient(row.id)}
                  aria-label={`remove ${row.name || 'ingredient'}`}
                  style={{
                    width: 22,
                    height: 22,
                    background: 'transparent',
                    border: 'none',
                    color: faintColor,
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,170,170,0.9)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = faintColor)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={_cellLabel}>solve for</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setSolveFor('water')} style={_segBtn(solveFor === 'water')}>water</button>
          <button onClick={() => setSolveFor('abv')} style={_segBtn(solveFor === 'abv')}>abv</button>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${ruleColor}`,
          paddingTop: 14,
          display: 'grid',
          gap: 10,
        }}
      >
        {solveFor === 'water' ? (
          <ResultRow label="target abv" embedded={embedded}>
            <input
              type="text"
              inputMode="decimal"
              value={targetAbv}
              onChange={onTargetAbvChange}
              style={{ ..._inputBase, width: 70, padding: '6px 10px', fontSize: 13, textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: dimColor, minWidth: 16 }}>%</span>
          </ResultRow>
        ) : (
          <ResultRow label="water" embedded={embedded}>
            <input
              type="text"
              inputMode="decimal"
              value={expertWater}
              onChange={onExpertWaterChange}
              style={{ ..._inputBase, width: 80, padding: '6px 10px', fontSize: 13, textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: dimColor, minWidth: 16 }}>{unit}</span>
          </ResultRow>
        )}

        {solveFor === 'water' && (
          <ResultRow label="water" embedded={embedded}>
            <span style={{ fontSize: 14, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(expert.water, unit)}
            </span>
            <span style={{ fontSize: 12, color: dimColor, minWidth: 16 }}>{unit}</span>
          </ResultRow>
        )}

        <ResultRow label="total" embedded={embedded}>
          <span style={{ fontSize: 14, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(expert.total, unit)}
          </span>
          <span style={{ fontSize: 12, color: dimColor, minWidth: 16 }}>{unit}</span>
        </ResultRow>

        {expert.unreachable && (
          <div style={{ fontSize: 11, color: 'rgba(255,200,140,0.85)', marginTop: -4 }}>
            target abv exceeds the blended spirit abv — already below this ABV without any water
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, children, embedded = false }: { label: string; children: React.ReactNode; embedded?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: embedded ? 'var(--fg)' : 'rgba(255,255,255,0.85)' }}>{label}</span>
      {children}
    </div>
  );
}
