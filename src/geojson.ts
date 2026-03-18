import {
    closeRing,
    ringIsClockwise,
    shallowClone,
} from './helpers';
import type {Ring} from "./types.ts";

/**
 * 调整多边形环的方向以符合 ArcGIS 标准
 * ArcGIS 要求：外环顺时针 (Clockwise)，内环（孔）逆时针 (Counter-clockwise)
 * @param poly GeoJSON 格式的多边形坐标数组 [外环, 孔1, 孔2...]
 */
const orientRings = (poly: Ring[]): Ring[] => {
    const output: Ring[] = [];
    const polygon = poly.slice(0);

    // 提取外环并闭合
    const firstRing = polygon.shift();
    if (!firstRing) return output;

    const outerRing = closeRing(firstRing.slice(0));

    if (outerRing.length >= 4) {
        // 如果外环不是顺时针，则反转它
        if (!ringIsClockwise(outerRing)) {
            outerRing.reverse();
        }
        output.push(outerRing);

        // 处理剩余的孔洞
        for (let i = 0; i < polygon.length; i++) {
            const hole = closeRing(polygon[i].slice(0));
            if (hole.length >= 4) {
                // 如果孔洞是顺时针，则反转为逆时针
                if (ringIsClockwise(hole)) {
                    hole.reverse();
                }
                output.push(hole);
            }
        }
    }

    return output;
};

/**
 * 将 MultiPolygon 的所有环拉平为一个一维的环数组
 * ArcGIS 不支持嵌套的 MultiPolygon 结构，所有环都平铺在 rings 字段中
 */
const flattenMultiPolygonRings = (rings: Ring[][]): Ring[] => {
    const output: Ring[] = [];
    for (let i = 0; i < rings.length; i++) {
        const polygon = orientRings(rings[i]);
        // 逆序推入，保持 ArcGIS 常见的存储习惯
        for (let x = polygon.length - 1; x >= 0; x--) {
            const ring = polygon[x].slice(0);
            output.push(ring);
        }
    }
    return output;
};

/**
 * GeoJSON 转 ArcGIS JSON 主函数
 * @param geojson GeoJSON 对象
 * @param idAttribute 指定要映射为 ArcGIS ID 的字段名，默认为 'OBJECTID'
 */
export const geojsonToArcGIS = (geojson: any, idAttribute: string = 'OBJECTID'): any => {
    const spatialReference = {wkid: 4326};
    let result: any = {};

    switch (geojson.type) {
        case 'Point':
            result.x = geojson.coordinates[0];
            result.y = geojson.coordinates[1];
            if (geojson.coordinates[2] != null) {
                result.z = geojson.coordinates[2];
            }
            result.spatialReference = spatialReference;
            break;

        case 'MultiPoint':
            result.points = geojson.coordinates.slice(0);
            if (geojson.coordinates[0]?.[2] != null) {
                result.hasZ = true;
            }
            result.spatialReference = spatialReference;
            break;

        case 'LineString':
            result.paths = [geojson.coordinates.slice(0)];
            if (geojson.coordinates[0]?.[2] != null) {
                result.hasZ = true;
            }
            result.spatialReference = spatialReference;
            break;

        case 'MultiLineString':
            result.paths = geojson.coordinates.slice(0);
            if (geojson.coordinates[0]?.[0]?.[2] != null) {
                result.hasZ = true;
            }
            result.spatialReference = spatialReference;
            break;

        case 'Polygon':
            result.rings = orientRings(geojson.coordinates.slice(0));
            if (geojson.coordinates[0]?.[0]?.[2] != null) {
                result.hasZ = true;
            }
            result.spatialReference = spatialReference;
            break;

        case 'MultiPolygon':
            result.rings = flattenMultiPolygonRings(geojson.coordinates.slice(0));
            if (geojson.coordinates[0]?.[0]?.[0]?.[2] != null) {
                result.hasZ = true;
            }
            result.spatialReference = spatialReference;
            break;

        case 'Feature':
            if (geojson.geometry) {
                result.geometry = geojsonToArcGIS(geojson.geometry, idAttribute);
            }
            result.attributes = geojson.properties ? shallowClone(geojson.properties) : {};
            // 将 GeoJSON 的 id 映射到 attributes 中
            if (geojson.id != null) {
                result.attributes[idAttribute] = geojson.id;
            }
            break;

        case 'FeatureCollection':
            result = geojson.features.map((f: any) => geojsonToArcGIS(f, idAttribute));
            break;

        case 'GeometryCollection':
            result = geojson.geometries.map((g: any) => geojsonToArcGIS(g, idAttribute));
            break;
    }

    return result;
};