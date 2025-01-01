/* tslint:disable */
/* eslint-disable */
/**
 * Schedule API
 * API for scheduling
 *
 * The version of the OpenAPI document: 1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface ScheduleState
 */
export interface ScheduleState {
    /**
     * 
     * @type {number}
     * @memberof ScheduleState
     */
    publishLength: number;
    /**
     * 
     * @type {number}
     * @memberof ScheduleState
     */
    draftLength: number;
    /**
     * 
     * @type {Date}
     * @memberof ScheduleState
     */
    firstDraftDate: Date;
    /**
     * 
     * @type {Date}
     * @memberof ScheduleState
     */
    lastHistoricDate: Date;
}

/**
 * Check if a given object implements the ScheduleState interface.
 */
export function instanceOfScheduleState(value: object): value is ScheduleState {
    if (!('publishLength' in value) || value['publishLength'] === undefined) return false;
    if (!('draftLength' in value) || value['draftLength'] === undefined) return false;
    if (!('firstDraftDate' in value) || value['firstDraftDate'] === undefined) return false;
    if (!('lastHistoricDate' in value) || value['lastHistoricDate'] === undefined) return false;
    return true;
}

export function ScheduleStateFromJSON(json: any): ScheduleState {
    return ScheduleStateFromJSONTyped(json, false);
}

export function ScheduleStateFromJSONTyped(json: any, ignoreDiscriminator: boolean): ScheduleState {
    if (json == null) {
        return json;
    }
    return {
        
        'publishLength': json['publish_length'],
        'draftLength': json['draft_length'],
        'firstDraftDate': (new Date(json['first_draft_date'])),
        'lastHistoricDate': (new Date(json['last_historic_date'])),
    };
}

export function ScheduleStateToJSON(json: any): ScheduleState {
    return ScheduleStateToJSONTyped(json, false);
}

export function ScheduleStateToJSONTyped(value?: ScheduleState | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'publish_length': value['publishLength'],
        'draft_length': value['draftLength'],
        'first_draft_date': ((value['firstDraftDate']).toISOString().substring(0,10)),
        'last_historic_date': ((value['lastHistoricDate']).toISOString().substring(0,10)),
    };
}
