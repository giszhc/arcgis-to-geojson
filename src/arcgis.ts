import {
    arrayIntersectsArray,
    coordinatesContainPoint,
    closeRing,
    ringIsClockwise,
    shallowClone,
} from './helpers';
import type {Ring} from "./types.ts";

/**
 * 判断外环是否完全包含内环
 */
const coordinatesContainCoordinates = (outer: Ring, inner: Ring): boolean => {
    const intersects = arrayIntersectsArray(outer, inner);
    const contains = coordinatesContainPoint(outer, inner[0]);
    // 如果不相交且起点在内部，则视为包含
    return !intersects && contains;
};

/**
 * 将 ArcGIS 的 rings 结构转换为 GeoJSON 的 Polygon 或 MultiPolygon
 * 核心逻辑：区分外环和孔洞，并处理坐标逆序以符合 RFC 7946 标准
 */
const convertRingsToGeoJSON = (rings: Ring[]): any => {
    const outerRings: Ring[][] = [];
    const holes: Ring[] = [];

    for (let r = 0; r < rings.length; r++) {
        const ring = closeRing(rings[r].slice(0));
        if (ring.length < 4) continue;

        // ArcGIS 规则：顺时针为外环，逆时针为内环（孔）
        if (ringIsClockwise(ring)) {
            // GeoJSON 规则 (RFC 7946)：外环必须是逆时针
            // 因此这里需要 .reverse()
            const polygon: Ring[] = [ring.slice().reverse()];
            outerRings.push(polygon);
        } else {
            // 内环（孔）在 GeoJSON 中必须是顺时针
            // ArcGIS 的内环本身是逆时针，所以也要 .reverse()
            holes.push(ring.slice().reverse());
        }
    }

    const uncontainedHoles: Ring[] = [];

    // 1. 尝试通过包含关系匹配孔洞
    while (holes.length) {
        const hole = holes.pop()!;
        let contained = false;
        for (let x = outerRings.length - 1; x >= 0; x--) {
            const outerRing = outerRings[x][0];
            if (coordinatesContainCoordinates(outerRing, hole)) {
                outerRings[x].push(hole);
                contained = true;
                break;
            }
        }
        if (!contained) uncontainedHoles.push(hole);
    }

    // 2. 对于未被完全包含的孔，尝试通过相交关系匹配
    // 处理某些不规范的数据源（如环边界重合）
    while (uncontainedHoles.length) {
        const hole = uncontainedHoles.pop()!;
        let intersects = false;

        for (let x = outerRings.length - 1; x >= 0; x--) {
            const outerRing = outerRings[x][0];
            if (arrayIntersectsArray(outerRing, hole)) {
                outerRings[x].push(hole);
                intersects = true;
                break;
            }
        }

        // 如果还是没匹配上，将其视为独立的外环（并再次反转回逆时针）
        if (!intersects) {
            outerRings.push([hole.reverse()]);
        }
    }

    if (outerRings.length === 1) {
        return {
            type: 'Polygon',
            coordinates: outerRings[0]
        };
    } else {
        return {
            type: 'MultiPolygon',
            coordinates: outerRings
        };
    }
};

/**
 * 获取要素 ID，优先级：用户指定 > OBJECTID > FID
 */
const getId = (attributes: any, idAttribute?: string): string | number => {
    const keys = idAttribute ? [idAttribute, 'OBJECTID', 'FID'] : ['OBJECTID', 'FID'];
    for (const key of keys) {
        if (
            key in attributes &&
            (typeof attributes[key] === 'string' || typeof attributes[key] === 'number')
        ) {
            return attributes[key];
        }
    }
    throw Error('No valid id attribute found');
};

/**
 * ArcGIS JSON 转 GeoJSON 主函数
 * @param arcgis ArcGIS 格式对象
 * @param idAttribute 可选的 ID 字段名
 */
export const arcgisToGeoJSON = (arcgis: any, idAttribute?: string): any => {
    let geojson: any = {};

    // 处理要素集合 (FeatureCollection)
    if (arcgis.features) {
        geojson.type = 'FeatureCollection';
        geojson.features = arcgis.features.map((f: any) => arcgisToGeoJSON(f, idAttribute));
        return geojson;
    }

    // 处理点 (Point)
    if (typeof arcgis.x === 'number' && typeof arcgis.y === 'number') {
        geojson.type = 'Point';
        geojson.coordinates = [arcgis.x, arcgis.y];
        if (typeof arcgis.z === 'number') geojson.coordinates.push(arcgis.z);
    }

    // 处理多点 (MultiPoint)
    if (arcgis.points) {
        geojson.type = 'MultiPoint';
        geojson.coordinates = arcgis.points.slice(0);
    }

    // 处理线 (LineString / MultiLineString)
    if (arcgis.paths) {
        if (arcgis.paths.length === 1) {
            geojson.type = 'LineString';
            geojson.coordinates = arcgis.paths[0].slice(0);
        } else {
            geojson.type = 'MultiLineString';
            geojson.coordinates = arcgis.paths.slice(0);
        }
    }

    // 处理面 (Polygon / MultiPolygon)
    if (arcgis.rings) {
        geojson = convertRingsToGeoJSON(arcgis.rings.slice(0));
    }

    // 处理外接矩形 (Extent / Envelope)
    if (
        typeof arcgis.xmin === 'number' && typeof arcgis.ymin === 'number' &&
        typeof arcgis.xmax === 'number' && typeof arcgis.ymax === 'number'
    ) {
        geojson.type = 'Polygon';
        geojson.coordinates = [[
            [arcgis.xmax, arcgis.ymax],
            [arcgis.xmin, arcgis.ymax],
            [arcgis.xmin, arcgis.ymin],
            [arcgis.xmax, arcgis.ymin],
            [arcgis.xmax, arcgis.ymax]
        ]];
    }

    // 处理要素 (Feature) 结构
    if (arcgis.geometry || arcgis.attributes) {
        const feature: any = {type: 'Feature'};
        feature.geometry = arcgis.geometry ? arcgisToGeoJSON(arcgis.geometry) : null;
        feature.properties = arcgis.attributes ? shallowClone(arcgis.attributes) : null;

        if (arcgis.attributes) {
            try {
                feature.id = getId(arcgis.attributes, idAttribute);
            } catch (err) { /* 忽略错误，不设置 id */
            }
        }
        geojson = feature;
    }

    // 几何体校验：空几何处理
    if (geojson.type === 'Feature' && JSON.stringify(geojson.geometry) === '{}') {
        geojson.geometry = null;
    }

    // 坐标系警告
    if (
        arcgis.spatialReference &&
        arcgis.spatialReference.wkid &&
        arcgis.spatialReference.wkid !== 4326
    ) {
        console.warn(`检测到非标准坐标系 (WKID: ${arcgis.spatialReference.wkid})，转换后的 GeoJSON 默认为 WGS84。`);
    }

    return geojson;
};