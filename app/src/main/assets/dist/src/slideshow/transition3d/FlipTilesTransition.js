/* -*- js-indent-level: 8 -*- */
class FlipTilesTransition extends SimpleTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initWebglFlags() {
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        // Enable face culling
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        // Disable blending
        this.gl.disable(this.gl.BLEND);
    }
    processPrimitives(t, texturePrimitive, applyOperations) {
        for (const primitive of texturePrimitive) {
            this.setBufferData(primitive.vertices);
            applyOperations.call(this, t, primitive.operations);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, primitive.vertices.length);
        }
    }
    displaySlides_(t) {
        this.applyAllOperation(t);
        // Render the entering slide primitives
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1]);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'slideTexture'), 0);
        this.processPrimitives(t, this.enteringPrimitives, this.applyEnteringOperations);
        // Render the leaving slide primitives
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[0]);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'slideTexture'), 0);
        this.processPrimitives(t, this.leavingPrimitives, this.applyLeavingOperations);
    }
}
function vec(x, y, nx, ny) {
    x = x < 0.0 ? 0.0 : x;
    x = Math.min(x, nx);
    y = y < 0.0 ? 0.0 : y;
    y = Math.min(y, ny);
    return [x / nx, y / ny];
}
function calculateMidpoint(vec1, vec2) {
    return [
        (vec1[0] + vec2[0]) / 2.0,
        (vec1[1] + vec2[1]) / 2.0,
        (vec1[2] + vec2[2]) / 2.0, // Z coordinate
    ];
}
function makeFlipTilesTransition(transitionParameters, n = 8, m = 6) {
    const aLeavingPrimitives = [];
    const aEnteringPrimitives = [];
    for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
            const aTile = new Primitive();
            const x11 = vec(x, y, n, m);
            const x12 = vec(x, y + 1, n, m);
            const x21 = vec(x + 1, y, n, m);
            const x22 = vec(x + 1, y + 1, n, m);
            aTile.pushTriangle(x21, x11, x12);
            aTile.pushTriangle(x22, x21, x12);
            aTile.operations.push(makeSRotate(vec3.fromValues(0, 1, 0), calculateMidpoint(aTile.getVertex(1), aTile.getVertex(3)), 180, true, (x11[0] * x11[1]) / 2.0, (x22[0] * x22[1] + 1.0) / 2.0));
            aLeavingPrimitives.push(Primitive.cloneDeep(aTile));
            aTile.operations.push(makeSRotate(vec3.fromValues(0, 1, 0), calculateMidpoint(aTile.getVertex(1), aTile.getVertex(3)), -180, false, (x11[0] * x11[1]) / 2.0, (x22[0] * x22[1] + 1.0) / 2.0));
            aEnteringPrimitives.push(aTile);
        }
    }
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: [],
    };
    return new FlipTilesTransition(newTransitionParameters);
}
SlideShow.makeFlipTilesTransition = makeFlipTilesTransition;
