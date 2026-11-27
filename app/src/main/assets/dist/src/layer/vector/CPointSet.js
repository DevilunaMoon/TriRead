// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
/*
 * CPointSet is a recursive datastructure used to represent a set of points connected by lines.
 * This is used by CPolyline and hence CPolygon classes to represent set of disconnected/disjoint
 * open/closed polygons respectively.
 */
class CPointSet {
    static fromPointArray(array) {
        var ps = new CPointSet();
        ps.points = array;
        return ps;
    }
    static fromSetArray(array) {
        var ps = new CPointSet();
        ps.pointSets = array;
        return ps;
    }
    static fromBounds(bounds) {
        var ps = new CPointSet();
        ps.points = [
            bounds.getTopLeft(),
            bounds.getTopRight(),
            bounds.getBottomRight(),
            bounds.getBottomLeft()
        ];
        return ps;
    }
    isFlat() {
        return this.points !== undefined;
    }
    empty() {
        return ((this.points === undefined && this.pointSets === undefined) ||
            (this.pointSets === undefined && this.points.length == 0));
    }
    getPointArray() {
        return this.points;
    }
    getSetArray() {
        return this.pointSets;
    }
    setPointArray(array) {
        this.points = array;
        this.pointSets = undefined;
    }
    setSetArray(array) {
        this.points = undefined;
        this.pointSets = array;
    }
    // This is used in CCellSelection to draw multiple polygons based on a "inner" point-set
    // where we need to apply an additive offset to each point in the pointSet w.r.t each polygon's centroid.
    applyOffset(offset, centroidSymmetry = false, preRound = true) {
        CPointSet.applyOffsetImpl(this, offset, centroidSymmetry, preRound);
    }
    clone() {
        return CPointSet.cloneImpl(this);
    }
    static cloneImpl(source) {
        const newPointSet = new CPointSet();
        if (source.points) {
            newPointSet.points = [];
            source.points.forEach(function (point) {
                newPointSet.points.push(point.clone());
            });
        }
        else if (source.pointSets) {
            newPointSet.pointSets = [];
            source.pointSets.forEach(function (childPointSet) {
                const clonedChild = CPointSet.cloneImpl(childPointSet);
                newPointSet.pointSets.push(clonedChild);
            });
        }
        return newPointSet;
    }
    static applyOffsetImpl(pointSet, offset, centroidSymmetry, preRound) {
        if (pointSet.empty())
            return;
        if (pointSet.isFlat()) {
            const refPoint = new cool.Point(Infinity, Infinity);
            if (centroidSymmetry) {
                refPoint.x = 0;
                refPoint.y = 0;
                // Compute centroid for this set of points.
                pointSet.points.forEach(function (point) {
                    refPoint._add(point);
                });
                refPoint._divideBy(pointSet.points.length);
            }
            pointSet.points.forEach(function (point, index) {
                if (preRound)
                    pointSet.points[index]._round();
                if (point.x < refPoint.x)
                    pointSet.points[index].x -= offset.x;
                else
                    pointSet.points[index].x += offset.x;
                if (point.y < refPoint.y)
                    pointSet.points[index].y -= offset.y;
                else
                    pointSet.points[index].y += offset.y;
            });
            return;
        }
        // not flat so recurse.
        pointSet.pointSets.forEach(function (childPointSet) {
            CPointSet.applyOffsetImpl(childPointSet, offset, centroidSymmetry, preRound);
        });
    }
}
