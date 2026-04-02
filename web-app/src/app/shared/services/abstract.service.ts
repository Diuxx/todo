import { HttpClient } from "@angular/common/http";


/**
 * Abstract service class for API services.
 *
 * @export
 * @abstract
 * @class AbstractService
 * @typedef {AbstractService}
 */
export abstract class AbstractService {

    /**
     * Htpp client.
     *
     * @public
     * @type {HttpClient}
     */
    public http: HttpClient;
    
    /**
     * Base URL of the backend API.
     *
     * @public
     * @type {string}
     */
    public baseUrl: string;

    /**
     * Constructor of Abstract service, initializing Http service
     * @param http
     */
    constructor(http: HttpClient) {
        this.http = http;
        /// This "base" field comes from the index.html page.
        this.baseUrl = document.getElementsByTagName('base')[0].href;
    }
}
