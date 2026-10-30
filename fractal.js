/* Draw bounded recursive fractal constructions in a responsive high-DPI canvas. */
'use strict';

const canvas = document.getElementById('fractal-canvas');
const context = canvas.getContext('2d');
const typeControl = document.getElementById('fractal-type');
const depthControl = document.getElementById('recursion');
const forms = {
    cantor: { max: 9, description: 'Remove the middle third of each segment. Each row adds one recursion step.' },
    tree: { max: 12, description: 'Split each branch into two smaller branches at a fixed angle.' },
    koch: { max: 6, description: 'Replace the middle third of each edge with an outward triangular peak.' },
    carpet: { max: 5, description: 'Divide each square into nine and remove the center square, then repeat.' },
    triangle: { max: 9, description: 'Divide a triangle into four and keep its three corner triangles.' },
    vicsek: { max: 6, description: 'Divide a square into nine and keep the center and four corner squares.' }
};
// Fixed grammars keep the interface limited to type and recursion depth.
// References: Robert Dickau's 2-D L-Systems and Paul Bourke's L-System manual.
const curveSystems = {
    dragon: { name: 'Dragon curve', max: 15, axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, draw: 'F', description: 'Fold a line into two right-angle copies at each step.' },
    levy: { name: 'Lévy C curve', max: 15, axiom: 'F', rules: { F: '+F--F+' }, angle: 45, draw: 'F', description: 'Replace each segment with two segments meeting at a right angle.' },
    hilbert: { name: 'Hilbert curve', max: 7, axiom: 'A', rules: { A: '+BF-AFA-FB+', B: '-AF+BFB+FA-' }, angle: 90, draw: 'F', description: 'Connect four rotated copies into an increasingly dense square-filling path.' },
    moore: { name: 'Moore curve', max: 6, axiom: 'AFA+F+AFA', rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' }, angle: 90, draw: 'F', description: 'Arrange Hilbert-like paths into the closed Moore curve.' },
    peano: { name: 'Peano curve', max: 5, axiom: 'A', rules: { A: 'AFBFA+F+BFAFB-F-AFBFA', B: 'BFAFB-F-AFBFA+F+BFAFB' }, angle: 90, draw: 'F', description: 'Visit nine smaller regions in a continuous square-filling path.' },
    gosper: { name: 'Gosper curve', max: 5, axiom: 'A', rules: { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' }, angle: 60, draw: 'AB', description: 'Join seven rotated copies along a hexagonal grid, also called the flowsnake.' },
    arrowhead: { name: 'Sierpiński arrowhead', max: 9, axiom: 'A', rules: { A: 'B-A-B', B: 'A+B+A' }, angle: 60, draw: 'AB', description: 'A continuous triangular path approaching the Sierpiński triangle.' },
    kochcurve: { name: 'Koch curve', max: 7, axiom: 'F', rules: { F: 'F+F--F+F' }, angle: 60, draw: 'F', description: 'Replace a straight segment with four segments forming a triangular bump.' },
    minkowski: { name: 'Minkowski sausage', max: 5, axiom: 'F', rules: { F: 'F+F-F-FF+F+F-F' }, angle: 90, draw: 'F', description: 'Replace each segment with eight right-angle steps in a square-grid pattern.' },
    quadratic: { name: 'Quadratic Koch curve', max: 6, axiom: 'F', rules: { F: 'F+F-F-F+F' }, angle: 90, draw: 'F', description: 'Build square bumps by replacing each segment with five shorter segments.' },
    terdragon: { name: 'Terdragon curve', max: 9, axiom: 'F', rules: { F: 'F+F-F' }, angle: 120, draw: 'F', description: 'Replace each line with three segments using alternating 120-degree turns.' },
    plant: { name: 'Fractal plant', max: 6, axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25, draw: 'F', heading: -90, description: 'Branch recursively with a fixed 25-degree angle to form a fern-like plant.' },
    bush: { name: 'Fractal bush', max: 5, axiom: 'F', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' }, angle: 22.5, draw: 'F', heading: -90, description: 'Grow symmetric clusters of branches using a fixed branching grammar.' },
    island: { name: 'Quadratic Koch island', max: 4, axiom: 'F-F-F-F', rules: { F: 'F-F+F+FFF-F-F+F' }, angle: 90, draw: 'F', description: 'Refine all four sides of a square with a repeating right-angle coastline.' }
};

for (const [key, system] of Object.entries(curveSystems)) {
    forms[key] = { max: system.max, description: system.description };
}

/**
 * Expand a fixed grammar and fit its turtle path inside the canvas.
 *
 * @param system - Grammar, drawing alphabet, angle, and initial heading.
 * @param depth - Number of grammar replacements; zero displays a seed segment.
 * @param width - Available canvas width in CSS pixels.
 * @param height - Available canvas height in CSS pixels.
 * @returns Draws the complete path with preserved aspect ratio and margins.
 */
function drawCurve(system, depth, width, height) {
    let commands = system.axiom;
    for (let iteration = 0; iteration < depth; iteration += 1) {
        const expanded = [];
        for (const symbol of commands) {
            expanded.push(system.rules[symbol] ?? symbol);
        }
        commands = expanded.join('');
    }

    let x = 0;
    let y = 0;
    let heading = (system.heading || 0) * Math.PI / 180;
    const turn = system.angle * Math.PI / 180;
    const stack = [];
    const segments = [];
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const symbol of commands) {
        if (system.draw.includes(symbol)) {
            const nextX = x + Math.cos(heading);
            const nextY = y + Math.sin(heading);
            segments.push([x, y, nextX, nextY]);
            x = nextX;
            y = nextY;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        } else if (symbol === '+') {
            heading += turn;
        } else if (symbol === '-') {
            heading -= turn;
        } else if (symbol === '[') {
            stack.push([x, y, heading]);
        } else if (symbol === ']') {
            [x, y, heading] = stack.pop();
        }
    }

    // Some grammars start with a non-drawing symbol; expose a visible seed at zero.
    if (segments.length === 0) {
        segments.push([0, 0, 1, 0]);
        maxX = 1;
    }
    const scale = Math.min(width * 0.82 / Math.max(maxX - minX, 1), height * 0.78 / Math.max(maxY - minY, 1));
    const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;
    context.beginPath();
    for (const [startX, startY, endX, endY] of segments) {
        context.moveTo(offsetX + startX * scale, offsetY + startY * scale);
        context.lineTo(offsetX + endX * scale, offsetY + endY * scale);
    }
    context.stroke();
}

let pendingFrame = 0;

/**
 * Fill a polygon from its ordered vertices.
 *
 * @param points - Array of coordinate pairs.
 * @returns Draws a filled polygon in the current canvas color.
 */
function polygon(points) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) {
        context.lineTo(...point);
    }
    context.closePath();
    context.fill();
}

/**
 * Subdivide a triangle into three self-similar corner triangles.
 *
 * @param x - Left coordinate.
 * @param y - Top coordinate.
 * @param size - Triangle width.
 * @param depth - Remaining subdivisions.
 * @returns Draws all remaining triangle leaves.
 */
function triangle(x, y, size, depth) {
    const height = size * Math.sqrt(3) / 2;
    if (depth === 0) {
        polygon([[x + size / 2, y], [x + size, y + height], [x, y + height]]);
        return;
    }
    triangle(x + size / 4, y, size / 2, depth - 1);
    triangle(x, y + height / 2, size / 2, depth - 1);
    triangle(x + size / 2, y + height / 2, size / 2, depth - 1);
}

/**
 * Recursively retain squares according to the selected construction.
 *
 * @param x - Left coordinate.
 * @param y - Top coordinate.
 * @param size - Square side length.
 * @param depth - Remaining subdivisions.
 * @param type - Carpet or Vicsek retention rule.
 * @returns Fills retained square leaves.
 */
function squares(x, y, size, depth, type) {
    if (depth === 0) {
        context.fillRect(x, y, size, size);
        return;
    }
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
            const keep = type === 'carpet' ? row !== 1 || col !== 1 : (row === 1 && col === 1) || (row !== 1 && col !== 1);
            if (keep) {
                squares(x + col * size / 3, y + row * size / 3, size / 3, depth - 1, type);
            }
        }
    }
}

/**
 * Append a Koch edge to an open path, keeping peaks outside a clockwise polygon.
 *
 * @param a - Starting coordinate pair.
 * @param b - Ending coordinate pair.
 * @param depth - Remaining edge replacements.
 * @returns Appends edge endpoints to the active path.
 */
function koch(a, b, depth) {
    if (depth === 0) {
        context.lineTo(...b);
        return;
    }
    const dx = (b[0] - a[0]) / 3;
    const dy = (b[1] - a[1]) / 3;
    const first = [a[0] + dx, a[1] + dy];
    const last = [a[0] + 2 * dx, a[1] + 2 * dy];
    const peak = [first[0] + dx / 2 + dy * Math.sqrt(3) / 2, first[1] + dy / 2 - dx * Math.sqrt(3) / 2];
    koch(a, first, depth - 1);
    koch(first, peak, depth - 1);
    koch(peak, last, depth - 1);
    koch(last, b, depth - 1);
}

/**
 * Grow a binary tree using a fixed branch ratio and angle.
 *
 * @param x - Branch starting horizontal coordinate.
 * @param y - Branch starting vertical coordinate.
 * @param length - Branch length.
 * @param angle - Heading in radians.
 * @param depth - Remaining splits.
 * @returns Appends all branches to the current path.
 */
function tree(x, y, length, angle, depth) {
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    if (depth > 0) {
        tree(endX, endY, length * 0.68, angle - Math.PI / 6, depth - 1);
        tree(endX, endY, length * 0.68, angle + Math.PI / 6, depth - 1);
    }
}

/**
 * Draw successive rows of the Cantor construction.
 *
 * @param x - Segment start.
 * @param y - Current row position.
 * @param length - Current segment length.
 * @param gap - Distance between recursion rows.
 * @param depth - Remaining removals.
 * @returns Fills segments in each construction row.
 */
function cantor(x, y, length, gap, depth) {
    context.fillRect(x, y, length, 6);
    if (depth > 0) {
        cantor(x, y + gap, length / 3, gap, depth - 1);
        cantor(x + length * 2 / 3, y + gap, length / 3, gap, depth - 1);
    }
}

/**
 * Validate depth and paint the selected construction at the available resolution.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns Updates canvas, accessible description, and depth guidance.
 */
function render() {
    const type = typeControl.value;
    const form = forms[type];
    const parsed = Number(depthControl.value);
    const depth = Math.max(0, Math.min(form.max, Number.isFinite(parsed) ? Math.floor(parsed) : 0));
    depthControl.max = form.max;
    depthControl.value = depth;
    document.getElementById('depth-help').textContent = `0–${form.max} · 0 shows the starting shape.`;
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const palette = getComputedStyle(canvas);
    context.fillStyle = palette.getPropertyValue('--site-accent').trim();
    context.strokeStyle = context.fillStyle;
    context.lineWidth = 1.25;
    context.lineJoin = 'round';
    const size = Math.min(width, height) * 0.76;
    const left = (width - size) / 2;
    const top = (height - size) / 2;
    if (curveSystems[type]) {
        drawCurve(curveSystems[type], depth, width, height);
    } else if (type === 'triangle') {
        triangle(left, (height - size * Math.sqrt(3) / 2) / 2, size, depth);
    } else if (type === 'carpet' || type === 'vicsek') {
        squares(left, top, size, depth, type);
    } else if (type === 'cantor') {
        cantor(width * 0.08, height * 0.12, width * 0.84, height * 0.72 / Math.max(1, depth), depth);
    } else if (type === 'tree') {
        context.beginPath();
        tree(width / 2, height * 0.9, size * 0.3, -Math.PI / 2, depth);
        context.stroke();
    } else {
        // The snowflake grows to a circumcircle of this radius at every depth.
        const radius = size / 2;
        const points = [];
        for (const angle of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
            points.push([width / 2 + radius * Math.cos(angle), height / 2 + radius * Math.sin(angle)]);
        }
        context.beginPath();
        context.moveTo(...points[0]);
        for (let edge = 0; edge < 3; edge += 1) {
            koch(points[edge], points[(edge + 1) % 3], depth);
        }
        context.closePath();
        context.stroke();
    }
    const title = typeControl.selectedOptions[0].textContent;
    document.getElementById('form-title').textContent = title;
    document.getElementById('form-description').textContent = form.description;
    document.getElementById('render-status').textContent = `Recursion ${depth}`;
    canvas.setAttribute('aria-label', `${title} at recursion ${depth}. ${form.description}`);
}

/**
 * Coalesce resize and input events into one paint per animation frame.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns Schedules the latest requested fractal rendering.
 */
function scheduleRender() {
    cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(render);
}

typeControl.addEventListener('change', scheduleRender);
depthControl.addEventListener('input', scheduleRender);
new ResizeObserver(scheduleRender).observe(canvas);
scheduleRender();
