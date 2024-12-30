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
import type { EmployeeModel } from './EmployeeModel';
import {
    EmployeeModelFromJSON,
    EmployeeModelFromJSONTyped,
    EmployeeModelToJSON,
    EmployeeModelToJSONTyped,
} from './EmployeeModel';

/**
 * 
 * @export
 * @interface ShiftModel
 */
export interface ShiftModel {
    /**
     * 
     * @type {number}
     * @memberof ShiftModel
     */
    shiftId: number;
    /**
     * 
     * @type {Date}
     * @memberof ShiftModel
     */
    start: Date;
    /**
     * 
     * @type {Date}
     * @memberof ShiftModel
     */
    end: Date;
    /**
     * 
     * @type {string}
     * @memberof ShiftModel
     */
    location: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof ShiftModel
     */
    requiredSkills: Array<string>;
    /**
     * 
     * @type {EmployeeModel}
     * @memberof ShiftModel
     */
    employee: EmployeeModel | null;
}

/**
 * Check if a given object implements the ShiftModel interface.
 */
export function instanceOfShiftModel(value: object): value is ShiftModel {
    if (!('shiftId' in value) || value['shiftId'] === undefined) return false;
    if (!('start' in value) || value['start'] === undefined) return false;
    if (!('end' in value) || value['end'] === undefined) return false;
    if (!('location' in value) || value['location'] === undefined) return false;
    if (!('requiredSkills' in value) || value['requiredSkills'] === undefined) return false;
    if (!('employee' in value) || value['employee'] === undefined) return false;
    return true;
}

export function ShiftModelFromJSON(json: any): ShiftModel {
    return ShiftModelFromJSONTyped(json, false);
}

export function ShiftModelFromJSONTyped(json: any, ignoreDiscriminator: boolean): ShiftModel {
    if (json == null) {
        return json;
    }
    return {
        
        'shiftId': json['shift_id'],
        'start': (new Date(json['start'])),
        'end': (new Date(json['end'])),
        'location': json['location'],
        'requiredSkills': json['required_skills'],
        'employee': EmployeeModelFromJSON(json['employee']),
    };
}

export function ShiftModelToJSON(json: any): ShiftModel {
    return ShiftModelToJSONTyped(json, false);
}

export function ShiftModelToJSONTyped(value?: ShiftModel | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'shift_id': value['shiftId'],
        'start': ((value['start']).toISOString()),
        'end': ((value['end']).toISOString()),
        'location': value['location'],
        'required_skills': value['requiredSkills'],
        'employee': EmployeeModelToJSON(value['employee']),
    };
}

