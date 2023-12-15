import React, { useRef, useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import Box from '@mui/material/Box';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import TablePagination from '@mui/material/TablePagination';


import Helmet from 'react-helmet';
import PropTypes from "prop-types";
import L from 'leaflet';
import { Marker, useMap } from 'react-leaflet';

import { promiseToFlyTo, geoJsonToMarkers, clearMapLayers, getCurrentLocation } from 'lib/map';
import { trackerLocationsToGeoJson, trackerFeatureToHtmlMarker } from 'lib/coronavirus';
import { commafy, friendlyDate } from 'lib/util';
import { useCoronavirusTracker } from 'hooks';
import axios from 'axios';

import Layout from 'components/Layout';
import Container from 'components/Container';
import Map from 'components/Map';

const LOCATION = {
  lat: 0,
  lng: 0,
};
const CENTER = [LOCATION.lat, LOCATION.lng];
const DEFAULT_ZOOM = 1;
const timeToZoom = 2000;
const ZOOM = 10;

function countryPointToLayer (feature = {}, latlng) { 
  const { properties = {} } = feature;
  let updatedFormatted;
  let casesString;

  const {
    country,
    updated,
    cases, 
    deaths,
    recovered
  } = properties;

  casesString = `${cases}`;

  if      (cases > 1000000) { casesString = `${casesString.slice(0, -6)}M+`; }
  else if (cases > 1000)    { casesString = `${casesString.slice(0, -3)}k+`;  }
  
  if (updated)      { updatedFormatted = new Date(updated).toLocaleString(); }

  const html = `
    <span class="icon-marker">
      <span class="icon-marker-tooltip">
        <h2>${country}</h2>
        <ul>
          <li><strong>Confirmed:</strong> ${cases}</li>
          <li><strong>Deaths:</strong> ${deaths}</li>
          <li><strong>Recovered:</strong> ${recovered}</li>
          <li><strong>Last Update:</strong> ${updatedFormatted}</li>
        </ul>
      </span>
      ${casesString} 
    </span>
  `;

  return L.marker(latlng, {
    icon: L.divIcon({
      className: 'icon',
      html
    }),
    riseOnHover: true
  });
}

const MapEffect = ({ markerRef }) => {
  console.log('in MapEffect...');
  const map = useMap();

  useEffect(() => {
    if (!markerRef.current || !map) return;

    (async function run() {
      console.log('about to call axios to get the data...');

      const options = {
        method: 'GET',
        url: 'https://disease.sh/v3/covid-19/countries',
      };
      
      let response; 
      
      try { response = await axios.request(options); 
      } catch (error) { 
        console.error(error);  
        return; 
      }
      console.log(response.data);

      const data = response.data;     // for disease.sh
      const hasData = Array.isArray(data) && data.length > 0;
      if (!Array.isArray(data)) { console.log('not an array!'); return; }
      if (data.length === 0) { console.log('data length is === 0'); }

      if (!hasData) { console.log('No data, sorry!');  return; }

      const geoJson = {
        type: 'FeatureCollection',
        features: data.map((country = {}) => {
          const {countryInfo = {} } = country;
          const { lat, long: lng } = countryInfo;
          return {
            type: 'Feature',
            properties: {
              ...country,
            },
            geometry: {
              type: 'Point',
              coordinates: [ lng, lat]
            }
          }
        })
      }

      console.log('geoJson', geoJson);

      const geoJsonLayers = new L.GeoJSON(geoJson, { 
        pointToLayer: countryPointToLayer
      });
      var _map = markerRef.current._map;
      geoJsonLayers.addTo(_map);

      const location = await getCurrentLocation().catch(() => LOCATION);

      setTimeout(async () => {
        await promiseToFlyTo(map, { zoom: ZOOM, center: location, });
      }, timeToZoom);
    })();
  }, [map, markerRef]);

  return null;
};

MapEffect.propTypes = {
  markerRef: PropTypes.object,
};




const TotalCasesBar = ({ countriesData }) => {

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const COUNTRIES_PER_PAGE = 5;

  if (!countriesData) {
    return;
  }

  const handleBackClick = () => {
    if (currentPageIndex <= 0) {
      return;
    }
    setCurrentPageIndex(currentPageIndex - 1);
  }
  const handleForwardClick = () => {
    if (currentPageIndex >= Math.floor(countriesData.length / COUNTRIES_PER_PAGE)) {
      return;
    }
    setCurrentPageIndex(currentPageIndex + 1);
  }

  let data = countriesData.slice(currentPageIndex * COUNTRIES_PER_PAGE, currentPageIndex * COUNTRIES_PER_PAGE + COUNTRIES_PER_PAGE);

  console.log("Total Cases", data);
  return (
    <div style={{width: '100%', height: '100%'}}>
      <div className='bar-button-controls'>
        <button className='back-btn' onClick={handleBackClick}>←</button>
        <button className='forward-btn' onClick={handleForwardClick}>→</button>
      </div>
      <ResponsiveBar 
      data={data}
      indexBy='country'
      keys={['cases']}
      margin={{
        top: 50,
        right: 130,
        bottom: 50,
        left: 120
      }}
      padding={0.5}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'Country',
        legendOffset: 40,
        legendPosition: 'middle',
        truncateTickAt: 0
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: "Total Cases",
        legendPosition: 'middle',
        legendOffset: -70,
        truncateTickAt: 0
      }}
      labelSkipWidth={12}
      labelSkipHeight={12}
      labelTextColor={{
        from: 'color',
        modifiers: [
          [
          'darker',
          1.6
        ]
      ]
      }}
      legends={[
        {
          dataFrom: 'keys',
          anchor: 'bottom-right',
          direction: 'column',
          justify: false,
          translateX: 120,
          translateY: 0,
          itemsSpacing: 2,
          itemWidth: 100,
          itemHeight: 20,
          itemDirection: 'left-to-right',
          itemOpacity: 0.85,
          symbolSize: 20,
          effects: [
            {
              on: 'hover',
              style: {
                itemOpacity: 1
              }
            }
          ]
        }
      ]}
      >
      </ResponsiveBar>
      </div>
  )
}

const DeathsActiveRecoveredBar = ({ countriesData }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const COUNTRIES_PER_PAGE = 5;

  if (!countriesData) {
    return;
  }

  const handleBackClick = () => {
    if (currentPageIndex <= 0) {
      return;
    }
    setCurrentPageIndex(currentPageIndex - 1);
  }
  const handleForwardClick = () => {
    if (currentPageIndex >= Math.floor(countriesData.length / COUNTRIES_PER_PAGE)) {
      return;
    }
    setCurrentPageIndex(currentPageIndex + 1);
  }

  let data = countriesData.slice(currentPageIndex * COUNTRIES_PER_PAGE, currentPageIndex * COUNTRIES_PER_PAGE + COUNTRIES_PER_PAGE);
  console.log("Deaths and Active", data);
  return (
    <div style={{width: '100%', height: '100%'}}>
      <div className='bar-button-controls'>
        <button className='back-btn' onClick={handleBackClick}>←</button>
        <button className='forward-btn' onClick={handleForwardClick}>→</button>
      </div>
    <ResponsiveBar 
    data={data}
    indexBy='country'
    keys={['deaths', 'active', 'critical', 'recovered']}
    margin={{
      top: 50,
      right: 130,
      bottom: 50,
      left: 120
    }}
    padding={0.5}
    axisTop={null}
    axisRight={null}
    axisBottom={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: 'Country',
      legendOffset: 40,
      legendPosition: 'middle',
      truncateTickAt: 0
    }}
    axisLeft={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: "Total Number",
      legendPosition: 'middle',
      legendOffset: -70,
      truncateTickAt: 0
    }}
    labelSkipWidth={12}
    labelSkipHeight={12}
    labelTextColor={{
      from: 'color',
      modifiers: [
        [
        'darker',
        1.6
      ]
    ]
    }}
    legends={[
      {
        dataFrom: 'keys',
        anchor: 'bottom-right',
        direction: 'column',
        justify: false,
        translateX: 120,
        translateY: 0,
        itemsSpacing: 2,
        itemWidth: 100,
        itemHeight: 20,
        itemDirection: 'left-to-right',
        itemOpacity: 0.85,
        symbolSize: 20,
        effects: [
          {
            on: 'hover',
            style: {
              itemOpacity: 1
            }
          }
        ]
      }
    ]}
    ></ResponsiveBar>
    </div>
  )
}

const CurrentDayDataBar = ({ countriesData }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const COUNTRIES_PER_PAGE = 5;
  if (!countriesData) {
    return;
  }

  const handleBackClick = () => {
    if (currentPageIndex <= 0) {
      return;
    }
    setCurrentPageIndex(currentPageIndex - 1);
  }
  const handleForwardClick = () => {
    if (currentPageIndex >= Math.floor(countriesData.length / COUNTRIES_PER_PAGE)) {
      return;
    }
    setCurrentPageIndex(currentPageIndex + 1);
  }

  let data = countriesData.slice(currentPageIndex * COUNTRIES_PER_PAGE, currentPageIndex * COUNTRIES_PER_PAGE + COUNTRIES_PER_PAGE);
  console.log("Current Day", data);

  return (
    <div style={{width: '100%', height: '100%'}}>
      <div className='bar-button-controls'>
        <button className='back-btn' onClick={handleBackClick}>←</button>
        <button className='forward-btn' onClick={handleForwardClick}>→</button>
      </div>
    <ResponsiveBar 
    data={data}
    indexBy='country'
    keys={['todayCases', 'todayDeaths', 'todayRecovered']}
    margin={{
      top: 50,
      right: 130,
      bottom: 50,
      left: 120
    }}
    padding={0.5}
    axisTop={null}
    axisRight={null}
    axisBottom={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: 'Country',
      legendOffset: 40,
      legendPosition: 'middle',
      truncateTickAt: 0
    }}
    axisLeft={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: "Total Number",
      legendPosition: 'middle',
      legendOffset: -70,
      truncateTickAt: 0
    }}
    labelSkipWidth={12}
    labelSkipHeight={12}
    labelTextColor={{
      from: 'color',
      modifiers: [
        [
        'darker',
        1.6
      ]
    ]
    }}
    legends={[
      {
        dataFrom: 'keys',
        anchor: 'bottom-right',
        direction: 'column',
        justify: false,
        translateX: 120,
        translateY: 0,
        itemsSpacing: 2,
        itemWidth: 100,
        itemHeight: 20,
        itemDirection: 'left-to-right',
        itemOpacity: 0.85,
        symbolSize: 20,
        effects: [
          {
            on: 'hover',
            style: {
              itemOpacity: 1
            }
          }
        ]
      }
    ]}
    ></ResponsiveBar>
    </div>
  )
}

const PerOneMillionStats = ({countriesData}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const COUNTRIES_PER_PAGE = 5;
  if (!countriesData) {
    return;
  }

  const handleBackClick = () => {
    if (currentPageIndex <= 0) {
      return;
    }
    setCurrentPageIndex(currentPageIndex - 1);
  }
  const handleForwardClick = () => {
    if (currentPageIndex >= Math.floor(countriesData.length / COUNTRIES_PER_PAGE)) {
      return;
    }
    setCurrentPageIndex(currentPageIndex + 1);
  }

  let data = countriesData.slice(currentPageIndex * COUNTRIES_PER_PAGE, currentPageIndex * COUNTRIES_PER_PAGE + COUNTRIES_PER_PAGE);
  console.log("Current Day", data);

  return (
    <div style={{width: '100%', height: '100%'}}>
      <div className='bar-button-controls'>
        <button className='back-btn' onClick={handleBackClick}>←</button>
        <button className='forward-btn' onClick={handleForwardClick}>→</button>
      </div>
    <ResponsiveBar 
    data={data}
    indexBy='country'
    keys={['casesPerOneMillion', 'deathsPerOneMillion', 'testsPerOneMillion', 'activePerOneMillion', 'recoveredPerOneMillion', 'criticalPerOneMillion']}
    margin={{
      top: 50,
      right: 130,
      bottom: 50,
      left: 120
    }}
    padding={0.5}
    axisTop={null}
    axisRight={null}
    axisBottom={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: 'Country',
      legendOffset: 40,
      legendPosition: 'middle',
      truncateTickAt: 0
    }}
    axisLeft={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: 0,
      legend: "Total Number (Per One Million)",
      legendPosition: 'middle',
      legendOffset: -70,
      truncateTickAt: 0
    }}
    labelSkipWidth={12}
    labelSkipHeight={12}
    labelTextColor={{
      from: 'color',
      modifiers: [
        [
        'darker',
        1.6
      ]
    ]
    }}
    legends={[
      {
        dataFrom: 'keys',
        anchor: 'bottom-right',
        direction: 'column',
        justify: false,
        translateX: 120,
        translateY: 0,
        itemsSpacing: 2,
        itemWidth: 100,
        itemHeight: 20,
        itemDirection: 'left-to-right',
        itemOpacity: 0.85,
        symbolSize: 20,
        effects: [
          {
            on: 'hover',
            style: {
              itemOpacity: 1
            }
          }
        ]
      }
    ]}
    ></ResponsiveBar>
    </div>
  )
}

const CurrentSpreadTable = ({countriesData}) => {

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  }
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }

  if (!countriesData) {
    return;
  }

  return (
    <Box sx={{width: '100%'}}>
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
        <TableHead>
          <TableRow>
            <TableCell>Country</TableCell>
            <TableCell align="right">Active</TableCell>
            <TableCell align="right">Today's Cases</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {
              countriesData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow
                key={row.country}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.country}
                </TableCell>
                <TableCell align="right">{row.active}</TableCell>
                <TableCell align="right">{row.todayCases}</TableCell>
              </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
    <TablePagination
      rowsPerPageOptions={[10]}
      component='div'
      count={countriesData.length}
      rowsPerPage={10}
      page={page}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
     />
    </Box>
  );
}

const TotalPopulationCasesDeathsTable = ({countriesData}) => {
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  }
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }

  if (!countriesData) {
    return;
  }

  return (
    <Box sx={{width: '100%'}}>
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
        <TableHead>
          <TableRow>
            <TableCell>Country</TableCell>
            <TableCell align="right">Population</TableCell>
            <TableCell align="right">Cases</TableCell>
            <TableCell align='right'>Tests</TableCell>
            <TableCell align="right">Deaths</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {
              countriesData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow
                key={row.country}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.country}
                </TableCell>
                <TableCell align="right">{row.population}</TableCell>
                <TableCell align="right">{row.cases}</TableCell>
                <TableCell align='right'>{row.tests}</TableCell>
                <TableCell align="right">{row.deaths}</TableCell>
              </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
    <TablePagination
      rowsPerPageOptions={[10]}
      component='div'
      count={countriesData.length}
      rowsPerPage={10}
      page={page}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
     />
    </Box>
  );
}

const TotalPopulationRecoveredCritical = ({countriesData}) => {
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  }
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }

  if (!countriesData) {
    return;
  }

  return (
    <Box sx={{width: '100%'}}>
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
        <TableHead>
          <TableRow>
            <TableCell>Country</TableCell>
            <TableCell align="right">Population</TableCell>
            <TableCell align="right">Total Recovered</TableCell>
            <TableCell align='right'>Critical</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {
              countriesData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow
                key={row.country}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.country}
                </TableCell>
                <TableCell align="right">{row.population}</TableCell>
                <TableCell align="right">{row.recovered}</TableCell>
                <TableCell align='right'>{row.critical}</TableCell>
              </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
    <TablePagination
      rowsPerPageOptions={[10]}
      component='div'
      count={countriesData.length}
      rowsPerPage={10}
      page={page}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
     />
    </Box>
  );
}

const IndexPage = () => {
  const markerRef = useRef();
  const { data: countries = [] } = useCoronavirusTracker({
    api: 'countries',
  });

  const { data: stats = {} } = useCoronavirusTracker({
    api: 'all',
  });


  console.log('Stats', stats);
  const hasCountries = Array.isArray( countries ) && countries.length > 0;

  /**
   * mapEffect
   * @description Fires a callback once the page renders
   * @example Here this is and example of being used to zoom in and set a popup on load
   */

  async function mapEffect({ leafletElement: map } = {}) {
    if ( !map || !hasCountries ) return;

    clearMapLayers({
      map,
      excludeByName: ['Mapbox'],
    });

    const locationsGeoJson = trackerLocationsToGeoJson( countries );

    const locationsGeoJsonLayers = geoJsonToMarkers( locationsGeoJson, {
      onClick: handleOnMarkerClick,
      featureToHtml: trackerFeatureToHtmlMarker,
    });

    const bounds = locationsGeoJsonLayers.getBounds();

    locationsGeoJsonLayers.addTo( map );

    map.fitBounds( bounds );
  }

  function handleOnMarkerClick({ feature = {} } = {}, event = {}) {
    const { target = {} } = event;
    console.log(target);
    const { _map: map = {} } = target;

    const { geometry = {}, properties = {} } = feature;
    const { coordinates } = geometry;
    const { countryBounds, countryCode } = properties;

    promiseToFlyTo( map, {
      center: {
        lat: coordinates[1],
        lng: coordinates[0],
      },
      zoom: 3,
    });

    if ( countryBounds && countryCode !== 'US' ) {
      const boundsGeoJsonLayer = new L.GeoJSON( countryBounds );
      const boundsGeoJsonLayerBounds = boundsGeoJsonLayer.getBounds();

      map.fitBounds( boundsGeoJsonLayerBounds );
    }
  }

  const mapSettings = {
    center: CENTER,
    defaultBaseMap: 'Mapbox',
    zoom: DEFAULT_ZOOM,
    mapEffect,
  };

  return (
    <Layout pageName="home">
      <Helmet>
        <title>Home Page</title>
      </Helmet>

      <div className="tracker">
      <Map center={CENTER} zoom={DEFAULT_ZOOM}>
       <MapEffect markerRef={markerRef} />
       <Marker ref={markerRef} position={CENTER}></Marker>             
      </Map>

        <div className="tracker-stats">
          <ul>
            <li className="tracker-stat">
              <p className="tracker-stat-primary">
                { stats ? commafy( stats?.tests ) : '-' }
                <strong>Total Tests</strong>
              </p>
              <p className="tracker-stat-secondary">
                { stats ? commafy( stats?.testsPerOneMillion ) : '-' }
                <strong>Per 1 Million</strong>
              </p>
            </li>
            <li className="tracker-stat">
              <p className="tracker-stat-primary">
                { stats ? commafy( stats?.cases ) : '-' }
                <strong>Total Cases</strong>
              </p>
              <p className="tracker-stat-secondary">
                { stats ? commafy( stats?.casesPerOneMillion ) : '-' }
                <strong>Per 1 Million</strong>
              </p>
            </li>
            <li className="tracker-stat">
              <p className="tracker-stat-primary">
                { stats ? commafy( stats?.deaths ) : '-' }
                <strong>Total Deaths</strong>
              </p>
              <p className="tracker-stat-secondary">
                { stats ? commafy( stats?.deathsPerOneMillion ) : '-' }
                <strong>Per 1 Million</strong>
              </p>
            </li>
            <li className="tracker-stat">
              <p className="tracker-stat-primary">
                { stats ? commafy( stats?.active ) : '-' }
                <strong>Active</strong>
              </p>
            </li>
            <li className="tracker-stat">
              <p className="tracker-stat-primary">
                { stats ? commafy( stats?.critical ) : '-' }
                <strong>Critical</strong>
              </p>
            </li>
            <li className="tracker-stat">
              <p className="tracker-stat-primary">
                { stats ? commafy( stats?.recovered ) : '-' }
                <strong>Recovered</strong>
              </p>
            </li>
          </ul>
        </div>

        <div className="tracker-last-updated">
          <p>Last Updated: { stats ? friendlyDate( stats?.updated ) : '-' }</p>
        </div>
      </div>
      <div className='informational-graphs'>
        <h2 className='graphs-title'>Visualizations with Charts and Graphs</h2>
        <div className='bars-and-charts' style={{height: 400}}>
            <h3 className='graph-title'>Total Cases By Country</h3>
            <TotalCasesBar countriesData={countries} />
            <h3 className='graph-title'>Total Deaths, Active Cases, Recovered and Critical</h3>
            <DeathsActiveRecoveredBar countriesData={countries} />
            <h3 className='graph-title'> Today's COVID Statistics by Country</h3>
            <CurrentDayDataBar countriesData={countries} />
            <h3 className='graph-title'>Per One Million Stats By Country</h3>
            <PerOneMillionStats countriesData={countries} />
            <h3 className='graph-title'>Current Spread in Countries</h3>
            <CurrentSpreadTable countriesData={countries} />
            <h3 className='graph-title'>Total Population, Cases, and Deaths Per Country</h3>
            <TotalPopulationCasesDeathsTable countriesData={countries} /> 
            <h3 className='graph-title'>Total Population, Recovered, and Critical Per Country</h3>
            <TotalPopulationRecoveredCritical countriesData={countries} />         
      </div>
      </div>
    </Layout>
  );
};

export default IndexPage;