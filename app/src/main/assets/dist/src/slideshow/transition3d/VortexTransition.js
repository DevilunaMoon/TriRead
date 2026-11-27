/* -*- js-indent-level: 8 -*- */
class VortexTransitionImp extends PermTextureTransition {
    static { this.columns = 96; }
    static { this.rows = 96; }
    // How far behind the slide the tile walls reach, in slide units.
    static { this.wallDepth = 0.02; }
    // The walls are lit less than the tile face, by this factor.
    static { this.wallLight = 0.3; }
    // Floats per vertex: position, normal, texture coordinate and tile index.
    static { this.stride = 3 + 3 + 2 + 2; }
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initWebglFlags() {
        if (this.context.isDisposed())
            return;
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.disable(this.gl.CULL_FACE);
        this.gl.disable(this.gl.BLEND);
    }
    initBuffers() {
        if (this.meshVertexCount)
            return;
        this.meshVertexCount = this.uploadMesh(VortexTransitionImp.buildMesh(), VortexTransitionImp.stride, [
            ['a_position', 3, 0],
            ['a_normal', 3, 3],
            ['a_texCoord', 2, 6],
            ['a_tileIndex', 2, 8],
        ]);
    }
    // Every tile is a quad in the slide plane plus four walls going back from its edges, so a tile
    // looks solid while it turns. A wall vertex carries the wall light factor as the z component
    // of its normal, which is also how the shader tells the walls apart from the faces.
    static buildMesh() {
        const columns = VortexTransitionImp.columns;
        const rows = VortexTransitionImp.rows;
        const wallDepth = VortexTransitionImp.wallDepth;
        const wallLight = VortexTransitionImp.wallLight;
        // Six vertices for the face and six for each of the four walls.
        const verticesPerTile = 6 + 4 * 6;
        const data = new Float32Array(columns * rows * verticesPerTile * VortexTransitionImp.stride);
        let index = 0;
        const push = (x, y, z, light, u, v, tileX, tileY) => {
            data.set([x, y, z, 0, 0, light, u, v, tileX, tileY], index);
            index += VortexTransitionImp.stride;
        };
        for (let tileX = 0; tileX < columns; tileX++) {
            for (let tileY = 0; tileY < rows; tileY++) {
                const u0 = tileX / columns;
                const u1 = (tileX + 1) / columns;
                const v0 = tileY / rows;
                const v1 = (tileY + 1) / rows;
                const left = 2 * u0 - 1;
                const right = 2 * u1 - 1;
                const top = -2 * v0 + 1;
                const bottom = -2 * v1 + 1;
                // The face, as two triangles.
                push(left, bottom, 0, 1, u0, v1, tileX, tileY);
                push(right, bottom, 0, 1, u1, v1, tileX, tileY);
                push(right, top, 0, 1, u1, v0, tileX, tileY);
                push(left, bottom, 0, 1, u0, v1, tileX, tileY);
                push(right, top, 0, 1, u1, v0, tileX, tileY);
                push(left, top, 0, 1, u0, v0, tileX, tileY);
                // The walls, one quad per edge.
                const corners = [
                    [left, top, u0, v0],
                    [right, top, u1, v0],
                    [right, bottom, u1, v1],
                    [left, bottom, u0, v1],
                ];
                for (let edge = 0; edge < 4; edge++) {
                    const a = corners[edge];
                    const b = corners[(edge + 1) % 4];
                    push(a[0], a[1], 0, wallLight, a[2], a[3], tileX, tileY);
                    push(a[0], a[1], -wallDepth, wallLight, a[2], a[3], tileX, tileY);
                    push(b[0], b[1], 0, wallLight, b[2], b[3], tileX, tileY);
                    push(a[0], a[1], -wallDepth, wallLight, a[2], a[3], tileX, tileY);
                    push(b[0], b[1], -wallDepth, wallLight, b[2], b[3], tileX, tileY);
                    push(b[0], b[1], 0, wallLight, b[2], b[3], tileX, tileY);
                }
            }
        }
        return data;
    }
    getVertexShader() {
        return SlideshowShaders['VortexTransition.vert.glsl'];
    }
    displaySlides_(t) {
        const gl = this.gl;
        this.applyAllOperation(t);
        gl.uniform2f(gl.getUniformLocation(this.program, 'tileCount'), VortexTransitionImp.columns, VortexTransitionImp.rows);
        this.displayPermSlide_();
        const slideLocation = gl.getUniformLocation(this.program, 'slide');
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'slideTexture'), 0);
        for (const slide of [0, 1]) {
            gl.uniform1f(slideLocation, slide);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[slide]);
            gl.drawArrays(gl.TRIANGLES, 0, this.meshVertexCount);
        }
    }
}
function VortexTransition(transitionParameters) {
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: [],
        enteringPrimitives: [],
        allOperations: [],
    };
    return new VortexTransitionImp(newTransitionParameters);
}
SlideShow.VortexTransition = VortexTransition;
