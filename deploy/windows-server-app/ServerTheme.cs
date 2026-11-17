using System.Drawing.Drawing2D;

namespace LimixServer;

sealed class ServerLabel : Label
{
    public ServerLabel() { ForeColor=Color.FromArgb(235,235,235); }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.Clear(BackColor);
        TextRenderer.DrawText(e.Graphics,Text,Font,ClientRectangle,ForeColor,TextFormatFlags.WordBreak|TextFormatFlags.TextBoxControl);
    }
}

sealed class ServerButton : Button
{
    bool hovering, pressed, selected;

    public bool Primary { get; init; }
    public bool Navigation { get; init; }
    public bool Selected
    {
        get => selected;
        set { selected=value; Invalidate(); }
    }

    public ServerButton()
    {
        FlatStyle=FlatStyle.Flat;
        UseVisualStyleBackColor=false;
        Padding=new Padding(15,8,15,8);
        Margin=new Padding(0,4,8,4);
        MinimumSize=new Size(0,38);
        Cursor=Cursors.Hand;
        SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);
    }

    protected override void OnMouseEnter(EventArgs e) { hovering=true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hovering=false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button==MouseButtons.Left) { pressed=true; Invalidate(); }
        base.OnMouseDown(e);
    }
    protected override void OnMouseUp(MouseEventArgs e) { pressed=false; Invalidate(); base.OnMouseUp(e); }
    protected override void OnMouseCaptureChanged(EventArgs e) { pressed=false; Invalidate(); base.OnMouseCaptureChanged(e); }
    protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { pressed=false; Invalidate(); base.OnLostFocus(e); }
    protected override void OnEnabledChanged(EventArgs e)
    {
        if (!Enabled) { hovering=false; pressed=false; }
        Invalidate();
        base.OnEnabledChanged(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var canvas=Parent?.BackColor ?? ServerTheme.Window;
        var fill=Color.FromArgb(39,39,42);
        var outline=Color.FromArgb(66,66,70);
        var ink=Color.FromArgb(246,246,248);

        if (!Enabled) {
            fill=Color.FromArgb(30,30,32);
            outline=Color.FromArgb(55,55,58);
            ink=Color.FromArgb(176,176,180);
        } else if (Primary) {
            fill=pressed ? Color.FromArgb(198,198,204) : hovering ? Color.White : Color.FromArgb(233,233,237);
            outline=fill;
            ink=Color.FromArgb(20,20,22);
        } else if (selected) {
            fill=Color.FromArgb(55,55,60);
            outline=Color.FromArgb(104,104,112);
        } else if (pressed || hovering) {
            fill=Color.FromArgb(pressed ? 57 : 47,pressed ? 57 : 47,pressed ? 62 : 52);
        } else if (Navigation) {
            fill=outline=canvas;
            ink=Color.FromArgb(210,210,215);
        }

        if (SystemInformation.HighContrast) {
            canvas=SystemColors.Window;
            fill=selected && Enabled ? SystemColors.Highlight : SystemColors.ButtonFace;
            ink=!Enabled ? SystemColors.GrayText : selected ? SystemColors.HighlightText : SystemColors.ControlText;
            outline=SystemColors.ControlText;
        }

        e.Graphics.Clear(canvas);
        if (Width<3 || Height<3) return;
        e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;
        using var shape=new GraphicsPath();
        float diameter=Math.Min(Math.Min(Width-2,Height-2),20f*DeviceDpi/96f);
        var arc=new RectangleF(1,1,diameter,diameter);
        shape.AddArc(arc,180,90);
        arc.X=Width-1-diameter;
        shape.AddArc(arc,270,90);
        arc.Y=Height-1-diameter;
        shape.AddArc(arc,0,90);
        arc.X=1;
        shape.AddArc(arc,90,90);
        shape.CloseFigure();

        using var brush=new SolidBrush(fill);
        using var border=new Pen(Focused && ShowFocusCues && Enabled
            ? (Primary && !SystemInformation.HighContrast ? Color.FromArgb(112,112,118) : ink)
            : outline, Focused && ShowFocusCues ? 2f : 1f);
        e.Graphics.FillPath(brush,shape);
        e.Graphics.DrawPath(border,shape);
        var bounds=Rectangle.Inflate(ClientRectangle,-Padding.Left,-3);
        TextRenderer.DrawText(e.Graphics,Text,Font,bounds,ink,TextFormatFlags.VerticalCenter |
            TextFormatFlags.WordBreak | (Navigation ? TextFormatFlags.Left : TextFormatFlags.HorizontalCenter));
    }
}

static class ServerTheme
{
    public static readonly Color Window=Color.FromArgb(18,18,20);
    public static readonly Color Rail=Color.FromArgb(24,24,27);
    public static void Apply(Control root)
    {
        foreach(Control child in root.Controls)
        {
            child.ForeColor=Color.FromArgb(235,235,235);
            if(child is TextBoxBase || child is NumericUpDown)
            {
                child.BackColor=Color.FromArgb(32,32,32);
                child.ForeColor=Color.FromArgb(240,240,240);
            }
            Apply(child);
        }
    }
}
