import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { buildZipDistanceFilter } from '../src/index';

describe('Routing', () => {
	it('serves a landing page at /', async () => {
		const response = await SELF.fetch('https://example.com/');
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('Pilots N Paws Maps');
		expect(html).toContain('/maps/trips');
		expect(html).toContain('/maps/volunteers');
	});

	it('serves trips map at /maps/trips', async () => {
		const response = await SELF.fetch('https://example.com/maps/trips');
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('Trip Request Map');
	});

	it('serves volunteers map at /maps/volunteers', async () => {
		const response = await SELF.fetch('https://example.com/maps/volunteers');
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('Volunteer Location Map');
	});

	it('serves config at /api/config', async () => {
		const response = await SELF.fetch('https://example.com/api/config');
		expect(response.status).toBe(200);
		const body = await response.json<any>();
		expect(body).toHaveProperty('googleMapsApiKey');
	});
});

describe('buildZipDistanceFilter', () => {
	it('returns null when zip code input has no valid zips', () => {
		expect(buildZipDistanceFilter('abc,1234,', '10')).toBeNull();
	});

	it('uses distance to control degrees delta and supports comma-separated zip codes', () => {
		const filter10 = buildZipDistanceFilter('97201, 98101', '10');
		const filter200 = buildZipDistanceFilter('97201, 98101', '200');
		expect(filter10).not.toBeNull();
		expect(filter200).not.toBeNull();
		if (!filter10 || !filter200) return;

		// First param is degreesDelta, should be larger for 200 miles than 10 miles
		expect(Number(filter200.params[0])).toBeGreaterThan(Number(filter10.params[0]));

		// Make sure both zips were included as bound parameters (4 blocks, each includes both zips)
		const zips = filter10.params.filter((p) => typeof p === 'string');
		expect(zips).toContain('97201');
		expect(zips).toContain('98101');
	});
});
