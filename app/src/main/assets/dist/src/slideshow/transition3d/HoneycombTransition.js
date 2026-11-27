/* -*- js-indent-level: 8 -*- */
class HoneycombTransitionImp extends PermTextureTransition {
    static { this.columns = 21; }
    static { this.rows = 21; }
    // The gap between the cells, as a fraction of the cell size. The cells are drawn once at
    // 1 - border and once at 1 + border, and the larger pass fills the gaps.
    static { this.borderSize = 0.15; }
    // How far behind a cell its walls reach, in slide units.
    static { this.wallDepth = 0.3; }
    static { this.wallLight = 0.3; }
    // Floats per vertex: cell center with the wall depth as z, corner offset and normal.
    static { this.stride = 3 + 2 + 3; }
    // The six corners of a cell, in units that the shader scales to the cell size.
    static { this.corners = [
        [-3, -2],
        [0, -4],
        [3, -2],
        [3, 2],
        [0, 4],
        [-3, 2],
    ]; }
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initWebglFlags() {
        if (this.context.isDisposed())
            return;
        // The entering slide shows through the fading cells of the leaving one.
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.disable(this.gl.CULL_FACE);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }
    initBuffers() {
        if (this.meshVertexCount)
            return;
        this.meshVertexCount = this.uploadMesh(HoneycombTransitionImp.buildMesh(), HoneycombTransitionImp.stride, [
            ['a_center', 3, 0],
            ['a_offset', 2, 3],
            ['a_normal', 3, 5],
        ]);
    }
    // A cell is a fan of six triangles around its center plus six walls going back from its edges.
    // The vertex positions are worked out in the shader from the center and the corner offset, so
    // the same mesh serves the cells and the gap filler between them.
    static buildMesh() {
        const columns = HoneycombTransitionImp.columns;
        const rows = HoneycombTransitionImp.rows;
        const corners = HoneycombTransitionImp.corners;
        const wallDepth = HoneycombTransitionImp.wallDepth;
        const wallLight = HoneycombTransitionImp.wallLight;
        const data = [];
        const push = (center, depth, offset, light) => {
            data.push(center[0], center[1], depth, offset[0], offset[1], 0, 0, light);
        };
        for (let y = 0; y < rows + 2; y += 2) {
            for (let x = 0; x < columns + 2; x += 2) {
                const slideX = (y % 4 ? x : x + 1) / columns;
                const slideY = y / rows;
                const center = [2 * slideX - 1, -2 * slideY + 1];
                for (let i = 0; i < 6; i++) {
                    const a = corners[i];
                    const b = corners[(i + 1) % 6];
                    push(center, 0, a, 1);
                    push(center, 0, b, 1);
                    push(center, 0, [0, 0], 1);
                    push(center, 0, a, wallLight);
                    push(center, -wallDepth, a, wallLight);
                    push(center, 0, b, wallLight);
                    push(center, -wallDepth, a, wallLight);
                    push(center, -wallDepth, b, wallLight);
                    push(center, 0, b, wallLight);
                }
            }
        }
        return new Float32Array(data);
    }
    getVertexShader() {
        return SlideshowShaders['HoneycombTransition.vert.glsl'];
    }
    getFragmentShader() {
        return SlideshowShaders['HoneycombTransition.frag.glsl'];
    }
    displaySlides_(t) {
        const gl = this.gl;
        this.applyAllOperation(t);
        gl.uniform1f(gl.getUniformLocation(this.program, 'slideRatio'), this.context.canvas.height / this.context.canvas.width);
        this.displayPermSlide_();
        const selectedTextureLocation = gl.getUniformLocation(this.program, 'selectedTexture');
        const hexagonSizeLocation = gl.getUniformLocation(this.program, 'hexagonSize');
        const borderSize = HoneycombTransitionImp.borderSize;
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'slideTexture'), 0);
        // The entering slide is behind the leaving one, so it is drawn first for the blending to
        // work. Each slide is drawn as its cells and then as the filler between them.
        gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
        gl.uniform1f(selectedTextureLocation, 0.0);
        gl.uniform1f(hexagonSizeLocation, 1.0 - borderSize);
        gl.drawArrays(gl.TRIANGLES, 0, this.meshVertexCount);
        gl.uniform1f(hexagonSizeLocation, 1.0 + borderSize);
        gl.drawArrays(gl.TRIANGLES, 0, this.meshVertexCount);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
        gl.uniform1f(selectedTextureLocation, 1.0);
        gl.uniform1f(hexagonSizeLocation, 1.0 - borderSize);
        gl.drawArrays(gl.TRIANGLES, 0, this.meshVertexCount);
        gl.uniform1f(hexagonSizeLocation, 1.0 + borderSize);
        gl.drawArrays(gl.TRIANGLES, 0, this.meshVertexCount);
    }
}
function HoneycombTransition(transitionParameters) {
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: [],
        enteringPrimitives: [],
        allOperations: [],
    };
    return new HoneycombTransitionImp(newTransitionParameters);
}
SlideShow.HoneycombTransition = HoneycombTransition;
