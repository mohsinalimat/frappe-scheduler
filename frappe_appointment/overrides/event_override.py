import frappe
from frappe import _
from frappe.desk.doctype.event.event import Event
from frappe.integrations.doctype.google_calendar.google_calendar import (
	get_google_calendar_object,
	get_conference_data,
	repeat_on_to_google_calendar_recurrence_rule,
	get_attendees,
	format_date_according_to_google_calendar,
)
from googleapiclient.errors import HttpError
from frappe.utils import (
	add_days,
	add_to_date,
	get_datetime,
	get_request_site_address,
	get_system_timezone,
	get_weekdays,
	now_datetime,
)
from frappe_appointment.constants import (
	APPOINTMENT_GROUP,
	USER_APPOINTMENT_AVAILABILITY,
)


class EventOverride(Event):
	def before_insert(self):
		self.update_attendees_for_appointment_group()

	def update_attendees_for_appointment_group(self):
		if not self.custom_appointment_group:
			return

		appointment_group = frappe.get_doc(APPOINTMENT_GROUP, self.custom_appointment_group)

		members = appointment_group.members

		for member in members:
			try:
				user = frappe.get_doc(
					{
						"idx": len(self.event_participants),
						"doctype": "Event Participants",
						"parent": self.name,
						"reference_doctype": USER_APPOINTMENT_AVAILABILITY,
						"reference_docname": member.user,
						"email": member.user,
						"parenttype": "Event",
						"parentfield": "event_participants",
					}
				)
				self.event_participants.append(user)
			except Exception as e:
				pass


def insert_event_in_google_calendar_attendees(doc, method=None):
	google_calendar, account = get_google_calendar_object(doc.google_calendar)

	if not account.push_to_google_calendar:
		return

	event = {
		"summary": doc.subject,
		"description": doc.description,
		"google_calendar_event": 1,
	}

	event.update(
		format_date_according_to_google_calendar(
			doc.all_day,
			get_datetime(doc.starts_on),
			get_datetime(doc.ends_on) if doc.ends_on else None,
		)
	)

	if doc.repeat_on:
		event.update({"recurrence": repeat_on_to_google_calendar_recurrence_rule(doc)})

	attendees = get_attendees(doc)

	if doc.custom_sync_participants_google_calendars:
		event.update({"attendees": update_attendees(attendees)})
	else:
		event.update({"attendees": attendees})

	conference_data_version = 0

	if doc.add_video_conferencing:
		event.update({"conferenceData": get_conference_data(doc)})
		conference_data_version = 1

	try:

		event = (
			google_calendar.events()
			.insert(
				calendarId=doc.google_calendar_id,
				body=event,
				conferenceDataVersion=conference_data_version,
				sendUpdates="all",
			)
			.execute()
		)

		frappe.db.set_value(
			"Event",
			doc.name,
			{
				"google_calendar_event_id": event.get("id"),
				"google_meet_link": event.get("hangoutLink"),
			},
			update_modified=False,
		)

		frappe.msgprint(_("Event Synced with Google Calendar."))

	except HttpError as err:
		frappe.throw(
			_(
				"Google Calendar - Could not insert event in Google Calendar {0}, error code {1}."
			).format(account.name, err.resp.status)
		)


def update_attendees(attendees: list) -> list:
	for user in attendees:
		user["responseStatus"] = "accepted"
	return attendees
