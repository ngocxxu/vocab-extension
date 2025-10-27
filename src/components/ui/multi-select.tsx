import { CheckIcon, ChevronDown, XCircle } from "lucide-react";
import * as React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Separator } from "./separator";
import { cn } from "../../shared/utils/utils";

type MultiSelectOption = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  onValueChange: (value: string[]) => void;
  defaultValue?: string[];
  placeholder?: string;
  maxCount?: number;
  className?: string;
  disabled?: boolean;
};

export function MultiSelect({
  options,
  onValueChange,
  defaultValue = [],
  placeholder = "Select options",
  maxCount = 3,
  className,
  disabled = false,
}: MultiSelectProps) {
  const [selectedValues, setSelectedValues] = React.useState<string[]>(
    defaultValue
  );
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  React.useEffect(() => {
    setSelectedValues(defaultValue);
  }, [defaultValue]);

  const getOptionByValue = (value: string): MultiSelectOption | undefined => {
    return options.find((option) => option.value === value);
  };

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
        option.value.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  const toggleOption = (optionValue: string) => {
    if (disabled) {
      return;
    }
    const option = getOptionByValue(optionValue);
    if (option?.disabled) {
      return;
    }
    const newSelectedValues = selectedValues.includes(optionValue)
      ? selectedValues.filter((value) => value !== optionValue)
      : [...selectedValues, optionValue];
    setSelectedValues(newSelectedValues);
    onValueChange(newSelectedValues);
  };

  const handleClear = () => {
    if (disabled) {
      return;
    }
    setSelectedValues([]);
    onValueChange([]);
  };

  const handleTogglePopover = () => {
    if (disabled) {
      return;
    }
    setIsPopoverOpen((prev) => !prev);
  };

  React.useEffect(() => {
    if (!isPopoverOpen) {
      setSearchValue("");
    }
  }, [isPopoverOpen]);

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          onClick={handleTogglePopover}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between border rounded-md px-3",
            className
          )}
        >
          {selectedValues.length > 0 ? (
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                {selectedValues.slice(0, maxCount).map((value) => {
                  const option = getOptionByValue(value);
                  if (!option) {
                    return null;
                  }
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="m-0"
                    >
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4" />
                      )}
                      {option.label}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOption(value);
                        }}
                        className="ml-2 rounded-full hover:bg-secondary"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                {selectedValues.length > maxCount && (
                  <Badge variant="secondary" className="m-0">
                    +{selectedValues.length - maxCount} more
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="h-4 w-4 flex items-center justify-center rounded-sm hover:bg-secondary"
                >
                  <XCircle className="h-4 w-4" />
                </button>
                <Separator orientation="vertical" className="h-full mx-2" />
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-muted-foreground">{placeholder}</span>
              <ChevronDown className="h-4 w-4" />
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => toggleOption(option.value)}
                    disabled={option.disabled}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50"
                      )}
                    >
                      {isSelected && <CheckIcon className="h-4 w-4" />}
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4" />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {selectedValues.length > 0 && (
                <>
                  <CommandItem
                    onSelect={handleClear}
                    className="justify-center"
                  >
                    Clear
                  </CommandItem>
                  <CommandSeparator />
                </>
              )}
              <CommandItem
                onSelect={() => setIsPopoverOpen(false)}
                className="justify-center"
              >
                Close
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type { MultiSelectOption };

