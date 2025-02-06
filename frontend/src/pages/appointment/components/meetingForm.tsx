/**
 * External dependencies.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useFrappePostCall } from "frappe-react-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, X } from "lucide-react";
import { formatDate } from "date-fns";
import { toast } from "sonner";

/**
 * Internal dependencies.
 */
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Typography from "@/components/ui/typography";
import { useAppContext } from "@/context/app";
import {
  getTimeZoneOffsetFromTimeZoneString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import Spinner from "@/components/ui/spinner";

const contactFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  guests: z.array(z.string().email("Please enter a valid email address")),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface MeetingFormProps {
  onBack: VoidFunction;
  durationId: string;
}

const MeetingForm = ({ onBack,durationId }: MeetingFormProps) => {
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const [guestInput, setGuestInput] = useState("");
  const { call: bookMeeting, loading } = useFrappePostCall(
    `frappe_appointment.api.personal_meet.book_time_slot`
  );

  const { selectedDate, selectedSlot, timeZone } = useAppContext();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      guests: [],
    },
  });

  const handleGuestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addGuest();
    }
  };

  const addGuest = () => {
    const email = guestInput.trim();
    if (email && email.includes("@")) {
      const currentGuests = form.getValues("guests");
      if (!currentGuests.includes(email)) {
        form.setValue("guests", [...currentGuests, email]);
        setGuestInput("");
      }
    }
  };

  const removeGuest = (email: string) => {
    const currentGuests = form.getValues("guests");
    form.setValue(
      "guests",
      currentGuests.filter((guest) => guest !== email)
    );
  };
  const onSubmit = (data: ContactFormValues) => {
    const meetingData = {
      duration_id: durationId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone)
      ),
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      user_name: data.fullName,
      user_email: data.email,
      other_participants: data.guests.join(", "),
    };

    bookMeeting(meetingData)
      .then(() => {
        onBack();
        toast("Appointment has been scheduled", {
          description: `For ${formatDate(new Date(selectedDate), "d MMM, yyyy")} at ${formatDate(new Date(selectedSlot.start_time), "h a")}`,
          action: {
            label: "OK",
            onClick: () => toast.dismiss(),
          },
        });
      })
      .catch((err) => {
        const error = parseFrappeErrorMsg(err);
        toast(error || "Something went wrong", {
          action: {
            label: "OK",
            onClick: () => toast.dismiss(),
          },
        });
      });
  };

  return (
    <div className={`w-full md:h-[30rem] lg:w-[41rem] shrink-0 md:p-6 px-4`}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 h-full flex justify-between flex-col"
        >
          <div className="space-y-4">
            <Typography variant="p" className="text-2xl">
              Your contact info
            </Typography>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Full Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      className="active:ring-blue-400 focus-visible:ring-blue-400"
                      placeholder="John Doe"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      className="active:ring-blue-400 focus-visible:ring-blue-400"
                      placeholder="john.Doe@gmail.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                className="h-auto hover:bg-blue-50 text-blue-500 hover:text-blue-600 "
                onClick={() => setIsGuestsOpen(!isGuestsOpen)}
                disabled={loading}
              >
                {isGuestsOpen ? "Hide Guests" : "+ Add Guests"}
              </Button>

              {isGuestsOpen && (
                <div className="space-y-2">
                  <Input
                    placeholder="janedoe@hotmail.com, bob@gmail.com, etc."
                    value={guestInput}
                    className="active:ring-blue-400 focus-visible:ring-blue-400"
                    onChange={(e) => setGuestInput(e.target.value)}
                    onKeyDown={handleGuestKeyDown}
                    onBlur={addGuest}
                    disabled={loading}
                  />
                  <div className="flex flex-wrap gap-2">
                    {form.watch("guests").map((guest) => (
                      <div
                        key={guest}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded-full text-sm"
                      >
                        <span>{guest}</span>
                        <button
                          type="button"
                          onClick={() => removeGuest(guest)}
                          className="hover:text-blue-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
              onClick={onBack}
              variant="ghost"
              disabled={loading}
            >
              <ChevronLeft /> Back
            </Button>
            <Button
              disabled={loading}
              className="bg-blue-400 hover:bg-blue-500"
              type="submit"
            >
              {loading && <Spinner />} Schedule Meeting
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default MeetingForm;
