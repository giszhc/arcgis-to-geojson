import {defineConfig} from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'ArcGISToGeoJSON',
            fileName: 'arcgis-to-geojson',
            formats: ['es']
        }
    }
})
