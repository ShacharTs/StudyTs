interface MathItem {
  l: string;
  s: string;
  t?: string;
}

interface MathGroup {
  name: string;
  items: MathItem[];
}

export const MATH_GROUPS: MathGroup[] = [
  {
    name: 'Greek',
    items: [
      { l: 'α', s: '\\alpha ' }, { l: 'β', s: '\\beta ' }, { l: 'γ', s: '\\gamma ' },
      { l: 'δ', s: '\\delta ' }, { l: 'ε', s: '\\epsilon ' }, { l: 'θ', s: '\\theta ' },
      { l: 'λ', s: '\\lambda ' }, { l: 'μ', s: '\\mu ' }, { l: 'π', s: '\\pi ' },
      { l: 'ρ', s: '\\rho ' }, { l: 'σ', s: '\\sigma ' }, { l: 'φ', s: '\\phi ' },
      { l: 'ω', s: '\\omega ' }, { l: 'Δ', s: '\\Delta ' }, { l: 'Σ', s: '\\Sigma ' },
      { l: 'Ω', s: '\\Omega ' },
    ],
  },
  {
    name: 'Operators',
    items: [
      { l: '×', s: '\\times ' }, { l: '÷', s: '\\div ' }, { l: '±', s: '\\pm ' },
      { l: '∓', s: '\\mp ' }, { l: '·', s: '\\cdot ' }, { l: '•', s: '\\bullet ' },
      { l: '∗', s: '\\ast ' }, { l: '∘', s: '\\circ ' }, { l: '∇', s: '\\nabla ' },
      { l: '∂', s: '\\partial ' },
    ],
  },
  {
    name: 'Relations',
    items: [
      { l: '≤', s: '\\le ' }, { l: '≥', s: '\\ge ' }, { l: '≠', s: '\\ne ' },
      { l: '≈', s: '\\approx ' }, { l: '≡', s: '\\equiv ' }, { l: '∼', s: '\\sim ' },
      { l: '∈', s: '\\in ' }, { l: '∉', s: '\\notin ' }, { l: '⊂', s: '\\subset ' },
      { l: '⊆', s: '\\subseteq ' }, { l: '∀', s: '\\forall ' }, { l: '∃', s: '\\exists ' },
      { l: '∞', s: '\\infty ' },
    ],
  },
  {
    name: 'Arrows',
    items: [
      { l: '→', s: '\\to ' }, { l: '←', s: '\\gets ' }, { l: '⇒', s: '\\Rightarrow ' },
      { l: '⇐', s: '\\Leftarrow ' }, { l: '⇔', s: '\\Leftrightarrow ' }, { l: '↦', s: '\\mapsto ' },
    ],
  },
  {
    name: 'N-ary',
    items: [
      { l: '∑', s: '\\sum_{$0}^{} ', t: 'Summation' },
      { l: '∏', s: '\\prod_{$0}^{} ', t: 'Product' },
      { l: '∫', s: '\\int_{$0}^{} ', t: 'Integral' },
      { l: '∮', s: '\\oint_{$0}^{} ', t: 'Contour integral' },
      { l: '⋃', s: '\\bigcup_{$0}^{} ', t: 'Union' },
      { l: '⋂', s: '\\bigcap_{$0}^{} ', t: 'Intersection' },
      { l: 'lim', s: '\\lim_{$0} ', t: 'Limit' },
    ],
  },
  {
    name: 'Structures',
    items: [
      { l: 'a⁄b', s: '\\frac{$0}{} ', t: 'Fraction' },
      { l: '√', s: '\\sqrt{$0} ', t: 'Square root' },
      { l: 'ⁿ√', s: '\\sqrt[$0]{} ', t: 'Nth root' },
      { l: 'xⁿ', s: 'x^{$0} ', t: 'Superscript' },
      { l: 'xₙ', s: 'x_{$0} ', t: 'Subscript' },
      { l: '( )', s: '\\left( $0 \\right) ', t: 'Auto brackets' },
      { l: 'vec', s: '\\vec{$0} ', t: 'Vector' },
      { l: 'hat', s: '\\hat{$0} ', t: 'Hat' },
      { l: 'bar', s: '\\overline{$0} ', t: 'Overline' },
      { l: '[ ]', s: '\\begin{matrix}$0\\end{matrix} ', t: 'Matrix' },
      { l: '{ ', s: '\\begin{cases}$0\\end{cases} ', t: 'Cases' },
    ],
  },
];
