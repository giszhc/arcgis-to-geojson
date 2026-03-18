import type {Point, Ring} from "./types.ts";

/**
 * 判断两个线段数组（环/路径）是否相交
 * @param a 第一个点数组
 * @param b 第二个点数组
 * @returns 是否存在相交的线段
 */
export function arrayIntersectsArray(a: Ring, b: Ring): boolean {
    for (let i = 0; i < a.length - 1; i++) {
        for (let j = 0; j < b.length - 1; j++) {
            // 依次判断 a 中的线段与 b 中的线段是否交叉
            if (vertexIntersectsVertex(a[i], a[i + 1], b[j], b[j + 1])) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 判断两个线段 (a1-a2) 和 (b1-b2) 是否相交
 * 使用跨立实验原理实现
 */
export function vertexIntersectsVertex(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const uaT = ((b2[0] - b1[0]) * (a1[1] - b1[1])) - ((b2[1] - b1[1]) * (a1[0] - b1[0]));
    const ubT = ((a2[0] - a1[0]) * (a1[1] - b1[1])) - ((a2[1] - a1[1]) * (a1[0] - b1[0]));
    const uB = ((b2[1] - b1[1]) * (a2[0] - a1[0])) - ((b2[0] - b1[0]) * (a2[1] - a1[1]));

    if (uB !== 0) {
        const ua = uaT / uB;
        const ub = ubT / uB;

        // 如果参数 ua 和 ub 都在 0 到 1 之间，说明两条线段有交点
        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return true;
        }
    }

    return false;
}

/**
 * 判断多边形（由 coordinates 组成）是否包含某个点
 * 使用经典的射线法 (Ray-casting algorithm)
 * @param coordinates 多边形的环坐标
 * @param point 待检测的点
 */
export function coordinatesContainPoint(coordinates: Ring, point: Point): boolean {
    let contains = false;
    for (let i = -1, l = coordinates.length, j = l - 1; ++i < l; j = i) {
        if (((coordinates[i][1] <= point[1] && point[1] < coordinates[j][1]) ||
                (coordinates[j][1] <= point[1] && point[1] < coordinates[i][1])) &&
            (point[0] < (((coordinates[j][0] - coordinates[i][0]) * (point[1] - coordinates[i][1])) / (coordinates[j][1] - coordinates[i][1])) + coordinates[i][0])) {
            contains = !contains;
        }
    }
    return contains;
}

/**
 * 比较两个坐标点是否相等
 */
export function pointsEqual(a: Point, b: Point): boolean {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * 闭合环：如果起点和终点不一致，则将起点添加到末尾
 */
export function closeRing(coordinates: Ring): Ring {
    if (!pointsEqual(coordinates[0], coordinates[coordinates.length - 1])) {
        coordinates.push(coordinates[0]);
    }
    return coordinates;
}

/**
 * 判断环的方向是否为顺时针
 * 在 ArcGIS JSON 中，外环通常要求为顺时针，而 GeoJSON 要求为逆时针
 * 计算原理：鞋带公式 (Shoelace formula) 面积符号
 */
export function ringIsClockwise(ringToTest: Ring): boolean {
    let total = 0;
    let i = 0;
    const rLength = ringToTest.length;
    let pt1 = ringToTest[i];
    let pt2: Point;
    for (i; i < rLength - 1; i++) {
        pt2 = ringToTest[i + 1];
        // 累加 (x2-x1)(y2+y1)
        total += (pt2[0] - pt1[0]) * (pt2[1] + pt1[1]);
        pt1 = pt2;
    }
    return (total >= 0);
}

/**
 * 对象的浅拷贝
 * @param obj 待拷贝的对象
 */
export function shallowClone<T extends Record<string, any>>(obj: T): T {
    const target = {} as T;
    for (const i in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, i)) {
            target[i] = obj[i];
        }
    }
    return target;
}