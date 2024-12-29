import optapy.types
import optapy.score
import datetime
import enum

from pydantic import BaseModel


@optapy.problem_fact
class Employee:
    name: str
    skill_set: list[str]

    def __str__(self):
        return f'Employee(name={self.name})'

    def to_dict(self):
        return {
            'name': self.name,
            'skill_set': self.skill_set
        }

class EmployeeModel(BaseModel):
    name: str
    skill_set: list[str]


class AvailabilityType(enum.Enum):
    DESIRED = 'DESIRED'
    UNDESIRED = 'UNDESIRED'
    UNAVAILABLE = 'UNAVAILABLE'


@optapy.problem_fact
class Availability:
    employee: Employee
    date: datetime.date
    availability_type: AvailabilityType

    def __str__(self):
        return f'Availability(employee={self.employee}, date={self.date}, availability_type={self.availability_type})'

    def to_dict(self):
        return {
            'employee': self.employee.to_dict(),
            'date': self.date.isoformat(),
            'availability_type': self.availability_type.value
        }

class AvailabilityModel(BaseModel):
    employee: Employee
    date: datetime.date
    availability_type: AvailabilityType

class ScheduleState(BaseModel):
    publish_length: int
    draft_length: int
    first_draft_date: datetime.date
    last_historic_date: datetime.date

    def is_draft(self, shift):
        return shift.start >= datetime.datetime.combine(self.first_draft_date, datetime.time.min)

    def to_dict(self):
        return {
            'publish_length': self.publish_length,
            'draft_length': self.draft_length,
            'first_draft_date': self.first_draft_date.isoformat(),
            'last_historic_date': self.last_historic_date.isoformat()
        }


def shift_pinning_filter(solution, shift):
    return not solution.schedule_state.is_draft(shift)


@optapy.planning_entity(pinning_filter=shift_pinning_filter)
class Shift:
    id: int
    start: datetime.datetime
    end: datetime.datetime
    location: str
    required_skills: list[str]
    employee: Employee | None

    @optapy.planning_id
    def get_id(self):
        return self.id

    @optapy.planning_variable(Employee, value_range_provider_refs=['employee_range'])
    def get_employee(self):
        return self.employee

    def set_employee(self, employee):
        self.employee = employee

    def __str__(self):
        return f'Shift(id={self.id}, start={self.start}, end={self.end}, location={self.location}, ' \
               f'required_skills={self.required_skills}, employee={self.employee})'

    def to_dict(self):
        return {
            'start': self.start.isoformat(),
            'end': self.end.isoformat(),
            'location': self.location,
            'required_skills': self.required_skills,
            'employee': self.employee.to_dict() if self.employee is not None else None
        }

class ShiftModel(BaseModel):
    id: int
    start: datetime.datetime
    end: datetime.datetime
    location: str
    required_skills: list[str]
    employee: Employee | None

@optapy.planning_solution
class EmployeeSchedule(BaseModel):
    schedule_state: ScheduleState
    availability_list: list[Availability]
    employee_list: list[Employee]
    shift_list: list[Shift]
    solver_status: optapy.types.SolverStatus | None
    score: optapy.score.SimpleScore | None

    @optapy.problem_fact_collection_property(Employee)
    @optapy.value_range_provider('employee_range')
    def get_employee_list(self):
        return self.employee_list

    @optapy.problem_fact_collection_property(Availability)
    def get_availability_list(self):
        return self.availability_list

    @optapy.planning_entity_collection_property(Shift)
    def get_shift_list(self):
        return self.shift_list

    @optapy.planning_score(optapy.score.HardSoftScore)
    def get_score(self):
        return self.score

    def set_score(self, score):
        self.score = score

    def to_dict(self):
        return {
            'employee_list': list(map(lambda employee: employee.to_dict(), self.employee_list)),
            'availability_list': list(map(lambda availability: availability.to_dict(), self.availability_list)),
            'schedule_state': self.schedule_state.to_dict(),
            'shift_list': list(map(lambda shift: shift.to_dict(), self.shift_list)),
            'solver_status': self.solver_status.toString(),
            'score': self.score.toString(),
        }

class EmployeeScheduleModel(BaseModel):
    schedule_state: ScheduleState
    availability_list: list[AvailabilityModel]
    employee_list: list[EmployeeModel]
    shift_list: list[ShiftModel]
    solver_status: str | None
    score: str | None
