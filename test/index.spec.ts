import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

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
