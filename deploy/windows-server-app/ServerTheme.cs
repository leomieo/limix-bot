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
    bool hovering, pressed;
    public ServerButton()
    {
        FlatStyle=FlatStyle.Flat;
        UseVisualStyleBackColor=false;
        Padding=new Padding(12,7,12,7);
        Margin=new Padding(0,5,8,5);
        Cursor=Cursors.Hand;
        SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);
    }
    protected override void OnMouseEnter(EventArgs e) { hovering=true;Invalidate();base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hovering=false;pressed=false;Invalidate();base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { pressed=true;Invalidate();base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { pressed=false;Invalidate();base.OnMouseUp(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate();base.OnEnabledChanged(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
        var background=!Enabled?Color.FromArgb(35,35,35):pressed?Color.FromArgb(65,65,65):hovering?Color.FromArgb(55,55,55):Color.FromArgb(43,43,43);
        e.Graphics.Clear(background);
        using var border=new Pen(Focused&&Enabled?Color.White:Color.FromArgb(85,85,85));
        e.Graphics.DrawRectangle(border,0,0,Width-1,Height-1);
        TextRenderer.DrawText(e.Graphics,Text,Font,ClientRectangle,Enabled?Color.White:Color.FromArgb(185,185,185),TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.WordBreak);
        if(Focused&&ShowFocusCues)ControlPaint.DrawFocusRectangle(e.Graphics,Rectangle.Inflate(ClientRectangle,-4,-4),Color.White,background);
    }
}

static class ServerTheme
{
    public static void Apply(Control root)
    {
        foreach(Control child in root.Controls)
        {
            child.ForeColor=Color.FromArgb(235,235,235);
            if(child is Panel) child.BackColor=Color.FromArgb(18,18,18);
            if(child is TextBoxBase || child is NumericUpDown)
            {
                child.BackColor=Color.FromArgb(32,32,32);
                child.ForeColor=Color.FromArgb(240,240,240);
            }
            Apply(child);
        }
    }
}
