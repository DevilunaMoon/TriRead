/* -*- js-indent-level: 8 -*- */
class Primitive {
    constructor() {
        this.vertices = [];
        this.operations = [];
    }
    static cloneDeep(oldPrimitive) {
        const newPrimitive = new Primitive();
        newPrimitive.vertices = [...oldPrimitive.vertices];
        newPrimitive.operations = oldPrimitive.operations.map((operation) => {
            return operation;
        });
        return newPrimitive;
    }
    pushTriangle(slideLocation0, slideLocation1, slideLocation2) {
        let verts = [];
        const texs = [];
        verts.push([2 * slideLocation0[0] - 1, -2 * slideLocation0[1] + 1, 0.0]);
        verts.push([2 * slideLocation1[0] - 1, -2 * slideLocation1[1] + 1, 0.0]);
        verts.push([2 * slideLocation2[0] - 1, -2 * slideLocation2[1] + 1, 0.0]);
        const normal = this.cross(this.subtract(verts[0], verts[1]), this.subtract(verts[1], verts[2]));
        const isFacingUs = normal[2] >= 0.0;
        if (isFacingUs) {
            texs.push(slideLocation0);
            texs.push(slideLocation1);
            texs.push(slideLocation2);
        }
        else {
            texs.push(slideLocation0);
            texs.push(slideLocation2);
            texs.push(slideLocation1);
            verts = [];
            verts.push([2 * slideLocation0[0] - 1, -2 * slideLocation0[1] + 1, 0.0]);
            verts.push([2 * slideLocation2[0] - 1, -2 * slideLocation2[1] + 1, 0.0]);
            verts.push([2 * slideLocation1[0] - 1, -2 * slideLocation1[1] + 1, 0.0]);
        }
        this.vertices.push({ position: verts[0], normal: [0, 0, 1], texCoord: texs[0] }, { position: verts[1], normal: [0, 0, 1], texCoord: texs[1] }, { position: verts[2], normal: [0, 0, 1], texCoord: texs[2] });
    }
    getVertex(n) {
        return this.vertices[n].position;
    }
    subtract(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }
    cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
    }
    clear() {
        this.operations = [];
    }
}
SlideShow.Primitive = Primitive;
