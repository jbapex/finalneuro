import React, { useState, useEffect } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/use-media-query';

const SelectContext = React.createContext(null);

const useSelectContext = () => {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error('useSelectContext must be used within a Select provider');
  }
  return context;
};

const TriggerWrapper = React.forwardRef(({ asChild, ...props }, ref) => <div ref={ref} {...props} />);
TriggerWrapper.displayName = 'TriggerWrapper';

function getLabelFromChildren(children, value) {
  if (value === undefined || value === null) return undefined;
  let found = undefined;
  React.Children.forEach(children, (child) => {
    if (!child?.props) return;
    if (child.props.value !== undefined && String(child.props.value) === String(value)) {
      found = child.props.children;
    } else if (child.props?.children) {
      const nested = getLabelFromChildren(child.props.children, value);
      if (nested !== undefined) found = nested;
    }
  });
  return found;
}

const Select = (props) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [selectedLabel, setSelectedLabel] = useState(undefined);

  const contextValue = React.useMemo(() => ({
    isDesktop,
    selectedLabel,
    setSelectedLabel,
    ...props,
  }), [isDesktop, selectedLabel, props]);

  if (isDesktop) {
    return (
      <SelectPrimitive.Root {...props}>
        <SelectContext.Provider value={contextValue}>
          {props.children}
        </SelectContext.Provider>
      </SelectPrimitive.Root>
    );
  }

  return (
    <Drawer {...props}>
      <SelectContext.Provider value={contextValue}>
        {props.children}
      </SelectContext.Provider>
    </Drawer>
  );
};

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isDesktop } = useSelectContext();
  const TriggerComponent = isDesktop ? SelectPrimitive.Trigger : DrawerTrigger;
  const IconComponent = isDesktop ? SelectPrimitive.Icon : 'div';
  const triggerClassName = cn(
    'flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-4 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    className
  );
  return (
    <TriggerComponent ref={ref} asChild className={triggerClassName} {...props}>
      <TriggerWrapper ref={ref} className={triggerClassName}>
        {children}
        <IconComponent asChild>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </IconComponent>
      </TriggerWrapper>
    </TriggerComponent>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = React.forwardRef(({ className, children, position = 'popper', ...props }, ref) => {
  const { isDesktop, value, setSelectedLabel } = useSelectContext();

  useEffect(() => {
    if (isDesktop) return;
    if (setSelectedLabel && children != null) {
      const label = getLabelFromChildren(children, value);
      setSelectedLabel(label !== undefined ? label : '');
    }
  }, [isDesktop, value, children, setSelectedLabel]);

  if (isDesktop) {
    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-card text-card-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            position === 'popper' &&
              'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            className
          )}
          position={position}
          {...props}
        >
          <SelectPrimitive.Viewport
            className={cn(
              'p-1',
              position === 'popper' &&
                'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  }

  return (
    <DrawerContent ref={ref} className={cn("bg-card text-card-foreground", className)} {...props}>
      <DrawerHeader>
        <DrawerTitle>Selecione uma opção</DrawerTitle>
      </DrawerHeader>
      <div className="p-4">{children}</div>
    </DrawerContent>
  );
});
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const { isDesktop, onValueChange, onOpenChange, setSelectedLabel } = useSelectContext();

  const handleSelect = () => {
    if (setSelectedLabel) setSelectedLabel(children);
    if (onValueChange) {
      onValueChange(value);
    }
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  if (isDesktop) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className
        )}
        value={value}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <Check className="h-4 w-4" />
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }

  return (
    <DrawerClose asChild>
      <button
        ref={ref}
        className={cn(
          'flex w-full cursor-default select-none items-center rounded-sm py-2 px-2 text-sm outline-none data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className
        )}
        onClick={handleSelect}
        {...props}
      >
        {children}
      </button>
    </DrawerClose>
  );
});
SelectItem.displayName = 'SelectItem';

const SelectValue = React.forwardRef(({ className, placeholder, children, ...props }, ref) => {
  const { isDesktop, selectedLabel } = useSelectContext();

  if (isDesktop) {
    return <SelectPrimitive.Value ref={ref} className={className} placeholder={placeholder} {...props} />;
  }

  return (
    <span ref={ref} className={className} {...props}>
      {selectedLabel !== undefined && selectedLabel !== '' ? selectedLabel : placeholder}
    </span>
  );
});
SelectValue.displayName = 'SelectValue';


const SelectGroup = SelectPrimitive.Group;

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;


const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};